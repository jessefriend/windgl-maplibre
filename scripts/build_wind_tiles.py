#!/usr/bin/env python3
"""
Build WindGL tile pyramid from GRIB (GFS/HRRR/etc.)

Outputs:
  wind/<YYYYMMDDHH>/tile.json
  wind/<YYYYMMDDHH>/{z}/{x}/{y}.png

Tile scheme:
  - Equirectangular lon/lat tiling (the same math used by your Layer.computeVisibleTiles)
  - y=0 at the north pole (lat=+90), increasing southward to lat=-90
  - bounds per tile z/x/y:
      lon_left   = 360 * x / 2^z - 180
      lon_right  = 360 * (x+1) / 2^z - 180
      lat_top    = 90  - 180 * y / 2^z
      lat_bottom = 90  - 180 * (y+1) / 2^z

Requirements:
  pip install xarray cfgrib numpy pillow
  (Optional auto-download) pip install herbie-data

Typical usage:
  # If your GRIB has both U and V variables
  python build_wind_tiles.py --date 20250112T06 --in u_v.grib2 --out-root ./wind --minzoom 0 --maxzoom 3

  # If you have separate files (U, V):
  python build_wind_tiles.py --date 20250112T06 --in-u ugrd.grib2 --in-v vgrd.grib2 --out-root ./wind

  # Auto-download HRRR at 10m for a date/time (needs herbie)
  python build_wind_tiles.py --date 20250112T06 --download hrrr --out-root ./wind

Notes:
  - If auto min/max produces dull contrast, set --u-min/--u-max/--v-min/--v-max explicitly.
  - Default tile size is 1024 (matches your repo); can lower to 256 for speed.
"""

import argparse
import json
import math
import os
from pathlib import Path
import sys

import numpy as np
from PIL import Image


# optional (only if using --download)
try:
    from herbie import Herbie  # type: ignore
    HAVE_HERBIE = True
except Exception:
    HAVE_HERBIE = False

import numpy as np
import xarray as xr
from scipy.interpolate import griddata
from scipy.ndimage import map_coordinates

# ----------------------------- helpers -----------------------------

def parse_date_token(token: str) -> str:
    """
    Accepts formats like '20250112T06', '2025-01-12T06', '2025-01-12 06:00'
    Returns YYYYMMDDHH
    """
    t = token.strip().replace("-", "").replace(":", "").replace(" ", "").upper()
    t = t.replace("T", "")
    if len(t) < 10:
        raise ValueError("date must include hour, e.g. 20250112T06")
    return t[:10]


def load_uv_dataset(path_u, path_v, single_path,
                    u_name_guess=("ugrd10m","u10","u","UGRD"),
                    v_name_guess=("vgrd10m","v10","v","VGRD"),
                    target_res_deg=0.25):
    """
    Load U/V from GRIB, select 10 m AGL if needed, and ensure result is on a
    regular lat/lon grid with 1-D axes using griddata.
    Returns U_reg, V_reg as xarray.DataArray with dims ('lat','lon').
    """

    def open_filtered_single(p):
        # Try common filters for HRRR/GFS surface winds at 10 m
        trials = [
            {"typeOfLevel": "heightAboveGround", "level": 10},
            {"typeOfLevel": "heightAboveGround"},
            {"typeOfLevel": "surface"},
        ]
        last = None
        for fbk in trials:
            try:
                ds = xr.open_dataset(
                    p, engine="cfgrib",
                    backend_kwargs={"filter_by_keys": fbk, "indexpath": ""}
                )
                return ds
            except Exception as e:
                last = e
        raise RuntimeError(f"Could not open {p} with 10 m filters; last error: {last}")

    def pick_uv(ds):
        U = V = None
        for cand in u_name_guess:
            if cand in ds:
                U = ds[cand]
                break
        for cand in v_name_guess:
            if cand in ds:
                V = ds[cand]
                break
        if U is None or V is None:
            return None, None
        # drop time/step/level if present
        for dim in ("time", "valid_time", "step", "level"):
            if dim in U.dims:
                U = U.isel({dim: 0})
            if dim in V.dims:
                V = V.isel({dim: 0})
        return U, V

    if single_path:
        ds = open_filtered_single(single_path)
        U, V = pick_uv(ds)
        if U is None or V is None:
            raise RuntimeError(f"Could not find U/V variables in {list(ds.data_vars)}")
    else:
        if not (path_u and path_v):
            raise ValueError("Provide --in (single GRIB) or both --in-u and --in-v.")
        ds_u = xr.open_dataset(path_u, engine="cfgrib", backend_kwargs={"indexpath": ""})
        ds_v = xr.open_dataset(path_v, engine="cfgrib", backend_kwargs={"indexpath": ""})
        U, V = pick_uv(ds_u)[0], pick_uv(ds_v)[1]
        if U is None or V is None:
            raise RuntimeError(f"Could not find U/V in U file vars={list(ds_u.data_vars)}, V file vars={list(ds_v.data_vars)}")

    # Identify lat/lon coordinate arrays (may be 1-D or 2-D)
    lat_name = next((n for n in ["latitude","lat"] if n in U.coords), None)
    lon_name = next((n for n in ["longitude","lon"] if n in U.coords), None)
    if lat_name is None or lon_name is None:
        # Some HRRR provide x/y and lat/lon as variables not coords
        for name in ["latitude","lat"]:
            if name in U.variables:
                lat_name = name
                break
        for name in ["longitude","lon"]:
            if name in U.variables:
                lon_name = name
                break
    if lat_name is None or lon_name is None:
        raise RuntimeError(f"Could not locate latitude/longitude in coords/vars: {list(U.coords)} / {list(U.variables)}")

    latv = U[lat_name].values
    lonv = U[lon_name].values
    Uv = np.array(U.values)
    Vv = np.array(V.values)

    # If lon is 0..360, convert to -180..180
    lonv = np.where(lonv > 180, lonv - 360, lonv)

    # Make target regular lat/lon grid covering the data extent
    lat_min, lat_max = float(np.nanmin(latv)), float(np.nanmax(latv))
    lon_min, lon_max = float(np.nanmin(lonv)), float(np.nanmax(lonv))
    # Clamp to valid ranges
    lat_min = max(-90.0, lat_min); lat_max = min(90.0, lat_max)
    lon_min = max(-180.0, lon_min); lon_max = min(180.0, lon_max)

    # ensure at least a couple of steps
    dlat = target_res_deg
    dlon = target_res_deg
    tgt_lats = np.arange(lat_min, lat_max + 1e-6, dlat, dtype=float)
    tgt_lons = np.arange(lon_min, lon_max + 1e-6, dlon, dtype=float)

    # Prepare samples: flatten lat/lon and U/V to 1-D points
    lat_flat = latv.ravel()
    lon_flat = lonv.ravel()
    pts = np.column_stack([lon_flat, lat_flat])

    U_flat = Uv.ravel()
    V_flat = Vv.ravel()

    # Target mesh
    Lon_t, Lat_t = np.meshgrid(tgt_lons, tgt_lats)

    # Interpolate to regular grid (linear; fill NaNs with 0)
    U_reg = griddata(pts, U_flat, (Lon_t, Lat_t), method="linear")
    V_reg = griddata(pts, V_flat, (Lon_t, Lat_t), method="linear")
    U_reg = np.nan_to_num(U_reg, nan=0.0)
    V_reg = np.nan_to_num(V_reg, nan=0.0)

    # Wrap into DataArrays with 1-D lat/lon axes
    U_da = xr.DataArray(U_reg, dims=("lat","lon"),
                        coords={"lat": tgt_lats, "lon": tgt_lons},
                        name="U_mps")
    V_da = xr.DataArray(V_reg, dims=("lat","lon"),
                        coords={"lat": tgt_lats, "lon": tgt_lons},
                        name="V_mps")

    return U_da, V_da


def compute_global_minmax(U: xr.DataArray, V: xr.DataArray) -> tuple[float, float, float, float]:
    umin = float(np.nanmin(U.values))
    umax = float(np.nanmax(U.values))
    vmin = float(np.nanmin(V.values))
    vmax = float(np.nanmax(V.values))
    # avoid zero-width ranges
    if umax == umin:
        umax = umin + 1.0
    if vmax == vmin:
        vmax = vmin + 1.0
    return umin, umax, vmin, vmax


def to_byte(arr: np.ndarray, amin: float, amax: float) -> np.ndarray:
    arr = np.clip(arr, amin, amax)
    scaled = (arr - amin) / (amax - amin)
    return (scaled * 255.0 + 0.5).astype("uint8")


def tile_bounds_equirect(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    n = 2 ** z
    lon_left = 360.0 * x / n - 180.0
    lon_right = 360.0 * (x + 1) / n - 180.0
    lat_top = 90.0 - 180.0 * y / n
    lat_bottom = 90.0 - 180.0 * (y + 1) / n
    return lon_left, lat_top, lon_right, lat_bottom


def resample_tile(U_da, V_da, z, x, y, tile_size):
    """
    Sample U,V (dims: lat, lon) into a tile_size x tile_size equirect tile for z/x/y.
    Returns 2-D numpy arrays (H, W). Never 1-D.
    """
    # arrays
    U_grid = np.asarray(U_da.values)
    V_grid = np.asarray(V_da.values)
    lat_arr = np.asarray(U_da.coords["lat"].values)  # 1-D increasing
    lon_arr = np.asarray(U_da.coords["lon"].values)  # 1-D increasing

    # tile geographic bounds (equirect scheme used by your Layer)
    n = 2 ** z
    lon_left   = 360.0 * x / n - 180.0
    lon_right  = 360.0 * (x + 1) / n - 180.0
    lat_top    = 90.0  - 180.0 * y / n
    lat_bottom = 90.0  - 180.0 * (y + 1) / n

    # target lon/lat centers (tile pixels)
    lons = np.linspace(lon_left, lon_right, tile_size, endpoint=False) + (lon_right - lon_left) / tile_size / 2.0
    lats = np.linspace(lat_top, lat_bottom, tile_size, endpoint=False) + (lat_bottom - lat_top) / tile_size / 2.0

    # map lon/lat to fractional indices in source grid
    # ix in [0, nlon-1], iy in [0, nlat-1]
    nlat, nlon = U_grid.shape
    ix = np.interp(lons, lon_arr, np.arange(nlon))  # shape (W,)
    iy = np.interp(lats, lat_arr, np.arange(nlat))  # shape (H,)

    # build 2-D index grids for map_coordinates
    Ix, Iy = np.meshgrid(ix, iy)   # shapes (H,W)
    coords = np.vstack([Iy.ravel(), Ix.ravel()])  # order: [rows, cols]

    # bilinear sample (order=1). mode='nearest' keeps edges safe
    U_tile = map_coordinates(U_grid, coords, order=1, mode="nearest").reshape(tile_size, tile_size)
    V_tile = map_coordinates(V_grid, coords, order=1, mode="nearest").reshape(tile_size, tile_size)

    # replace any remaining NaNs (should be rare after 'nearest')
    U_tile = np.nan_to_num(U_tile, nan=0.0)
    V_tile = np.nan_to_num(V_tile, nan=0.0)
    return U_tile, V_tile


def write_png(path: Path, R: np.ndarray, G: np.ndarray):
    if R.ndim != 2 or G.ndim != 2:
        raise ValueError(f"Expected 2-D tiles, got shapes {R.shape} and {G.shape}")
    H, W = R.shape
    B = np.zeros((H, W), dtype=np.uint8)
    A = np.full((H, W), 255, dtype=np.uint8)
    rgba = np.dstack([R, G, B, A])
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(path, format="PNG", optimize=True)


def write_tilejson(path: Path, minzoom: int, maxzoom: int, tile_size: int,
                   umin: float, umax: float, vmin: float, vmax: float):
    tj = {
        "tiles": ["{z}/{x}/{y}.png"],
        "minzoom": minzoom,
        "maxzoom": maxzoom,
        "bounds": [-180.0, -85.0511, 180.0, 85.0511],  # pragmatic cutoff
        "tileSize": tile_size,
        "width": tile_size,
        "height": tile_size,
        "uMin": umin,
        "uMax": umax,
        "vMin": vmin,
        "vMax": vmax
    }
    path.write_text(json.dumps(tj, separators=(",", ":"), ensure_ascii=False))


def maybe_download(date_yyyymmddhh: str, model: str) -> Path | None:
    """
    Download a single GRIB that contains both U and V (HRRR/GFS), using Herbie.
    Returns the local GRIB Path (single file) or None on failure.
    """
    if not HAVE_HERBIE:
        print("Herbie not installed; cannot --download.", file=sys.stderr)
        return None

    y, m, d, h = date_yyyymmddhh[0:4], date_yyyymmddhh[4:6], date_yyyymmddhh[6:8], date_yyyymmddhh[8:10]
    from datetime import datetime
    dt = datetime(int(y), int(m), int(d), int(h))

    model = model.lower()
    if model == "hrrr":
        # Surface (sfc) analysis f00 includes 10 m U/V (ugrd10m, vgrd10m)
        H = Herbie(dt, model="hrrr", product="sfc", fxx=0, priority=["aws", "google"])
    elif model == "gfs":
        # 0.25-degree product; f00 includes UGRD/VGRD at 10 m above ground
        H = Herbie(dt, model="gfs", product="pgrb2.0p25", fxx=0, priority=["aws", "noaa"])
    else:
        print(f"Unsupported model for --download: {model}", file=sys.stderr)
        return None

    local_path = H.download()  # no variable/level args supported anymore
    print(f"[herbie] Downloaded: {local_path}")
    return Path(local_path) if local_path else None


# ----------------------------- main -----------------------------

def main():
    ap = argparse.ArgumentParser(description="Build WindGL tiles (equirectangular) from GRIB.")
    ap.add_argument("--date", required=True, help="YYYYMMDDHH or e.g. 2025-01-12T06")
    ap.add_argument("--in", dest="in_single", help="Path to a GRIB containing both U and V")
    ap.add_argument("--in-u", dest="in_u", help="Path to GRIB with U component (e.g., UGRD)")
    ap.add_argument("--in-v", dest="in_v", help="Path to GRIB with V component (e.g., VGRD)")
    ap.add_argument("--download", choices=["hrrr", "gfs"], help="Auto-download U/V via herbie")
    ap.add_argument("--u-var", default="u10,u,UGRD", help="Comma list of candidate U var names")
    ap.add_argument("--v-var", default="v10,v,VGRD", help="Comma list of candidate V var names")

    ap.add_argument("--out-root", default="./wind", help="Root output directory (default ./wind)")
    ap.add_argument("--minzoom", type=int, default=0)
    ap.add_argument("--maxzoom", type=int, default=3)
    ap.add_argument("--tile-size", type=int, default=1024)
    ap.add_argument("--grid-res", type=float, default=0.25,
                help="Target regular lat-lon grid resolution in degrees (default 0.25)")

    ap.add_argument("--u-min", type=float, help="Force U min (m/s)")
    ap.add_argument("--u-max", type=float, help="Force U max (m/s)")
    ap.add_argument("--v-min", type=float, help="Force V min (m/s)")
    ap.add_argument("--v-max", type=float, help="Force V max (m/s)")
    args = ap.parse_args()

    date_token = parse_date_token(args.date)
    out_dir = Path(args.out_root) / date_token
    out_dir.mkdir(parents=True, exist_ok=True)

    # Decide inputs
    in_single = Path(args.in_single) if args.in_single else None
    in_u = Path(args.in_u) if args.in_u else None
    in_v = Path(args.in_v) if args.in_v else None

    if args.download:
        p = maybe_download(date_token, args.download)
        if p:
            in_single = p  # one GRIB with both U and V
        else:
            print("Auto-download failed or herbie not installed.", file=sys.stderr)
            sys.exit(2)

    if not (in_single or (in_u and in_v)):
        print("Provide --in (single GRIB) or both --in-u and --in-v, or use --download.", file=sys.stderr)
        sys.exit(2)

    u_names = tuple([s.strip() for s in args.u_var.split(",") if s.strip()])
    v_names = tuple([s.strip() for s in args.v_var.split(",") if s.strip()])

    U, V = load_uv_dataset(in_u, in_v, in_single, u_name_guess=u_names, v_name_guess=v_names)

    # Global min/max (or forced)
    if args.u_min is not None and args.u_max is not None and args.v_min is not None and args.v_max is not None:
        umin, umax, vmin, vmax = args.u_min, args.u_max, args.v_min, args.v_max
    else:
        umin, umax, vmin, vmax = compute_global_minmax(U, V)

    print(f"[info] U range: {umin:.2f}..{umax:.2f} m/s, V range: {vmin:.2f}..{vmax:.2f} m/s")

    # Build tiles
    for z in range(args.minzoom, args.maxzoom + 1):
        n = 2 ** z
        for y in range(n):
            for x in range(n):
                U_tile, V_tile = resample_tile(U, V, z, x, y, args.tile_size)
                R = to_byte(U_tile, umin, umax)
                G = to_byte(V_tile, vmin, vmax)
                tile_path = out_dir / str(z) / str(x) / f"{y}.png"
                write_png(tile_path, R, G)

    # Write tile.json
    write_tilejson(out_dir / "tile.json", args.minzoom, args.maxzoom, args.tile_size, umin, umax, vmin, vmax)

    print(f"[done] Wrote tiles to {out_dir} and {out_dir/'tile.json'}")
    print("      Use in JS as: windGL.source('wind/{}/tile.json')".format(date_token))


if __name__ == "__main__":
    sys.exit(main())
