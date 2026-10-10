import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

import numpy as np
import xarray as xr


spec = importlib.util.spec_from_file_location(
    "build_wind_tiles", Path(__file__).parents[1] / "scripts" / "build_wind_tiles.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class GlobalGridTest(unittest.TestCase):
    def setUp(self):
        values = np.array([[0, 1, 2, 3], [10, 11, 12, 13], [20, 21, 22, 23]], dtype=float)
        dataset = xr.Dataset(
            {
                "u10": (("latitude", "longitude"), values),
                "v10": (("latitude", "longitude"), values + 100),
            },
            coords={"latitude": [90, 0, -90], "longitude": [0, 90, 180, 270]},
        )
        with patch.object(builder.xr, "open_dataset", return_value=dataset):
            self.u, self.v = builder.load_uv_dataset(None, None, "gfs.grib2")

    def test_gfs_axes_and_values_remain_aligned_after_sorting(self):
        np.testing.assert_array_equal(self.u.lat, [-90, 0, 90])
        np.testing.assert_array_equal(self.u.lon, [-180, -90, 0, 90, 180])
        expected = [[22, 23, 20, 21, 22], [12, 13, 10, 11, 12], [2, 3, 0, 1, 2]]
        np.testing.assert_array_equal(self.u.values, expected)
        np.testing.assert_array_equal(self.v.values, np.array(expected) + 100)

    def test_global_sampling_interpolates_across_the_dateline(self):
        u, v = builder.resample_tile(self.u, self.v, 0, 0, 0, 512)
        np.testing.assert_allclose(u[:, 0], u[:, -1], atol=0.02)
        np.testing.assert_allclose(v[:, 0], v[:, -1], atol=0.02)


if __name__ == "__main__":
    unittest.main()
