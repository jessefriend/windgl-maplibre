# Global wind sample

This directory contains NOAA GFS analysis winds at 10 m above ground.
The snapshot is from October 7, 2026, at 00:00 UTC. It is not a live forecast.

The input contains both UGRD and VGRD on the global 0.25-degree latitude/longitude grid.
The PNGs use WindGL's equirectangular tile layout, not Web Mercator XYZ tiles.
The pyramid contains 21 tiles at zoom levels 0 through 2. Each tile is 512 by 512 pixels.
The metadata uses one U/V range for the entire pyramid.

Source: [NOAA GFS on NOMADS](https://www.nco.ncep.noaa.gov/pmb/products/gfs/nomads/).

To build another snapshot, download only UGRD and VGRD at 10 m from the
[NOAA GRIB filter](https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl).
Select the full world and a run that is still available. Install the dependencies
listed in `scripts/build_wind_tiles.py`, then run:

```sh
python3 scripts/build_wind_tiles.py \
  --date YYYYMMDDHH --in /path/to/gfs-10m.grib2 \
  --out-root docs/wind/gfs --tile-size 512 --maxzoom 2 --workers 2
```

Record the source, model, and date in the new `tile.json`.
Update `WIND_SOURCE` in `demo.js` to use the new snapshot.
HRRR input covers the US and cannot provide worldwide wind data.
