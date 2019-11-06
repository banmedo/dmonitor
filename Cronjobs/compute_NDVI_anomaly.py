## global imports
import os
import gc

## config
FOLDER_SUFFIX = ["_dd","_mm","_3m"]
NDVI_FODLER_PREFIX =  "emodisNdvi"
ANOMALY_FOLDER_PREFIX = "ndviAnomaly"
DOWNLOAD_FOLDER = "e:/ndvi/"

## functions
def create_if_not_exists(path):
    if (not os.path.exists(path)):
        os.mkdir(path)
    return path

def create_anomaly_raster(name, input_dir, output_dir):
    epoch_start = 2002
    this_year = int(name[:4])

    if (os.path.exists(os.path.join(output_dir,name))):
        print("Anomaly file %s already exists"%name)
        return

    image_stack = []
    for year in range(this_year-10, this_year):
        if (os.path.exists(os.path.join(input_dir, str(year)+name[4:]))):
            image_stack.append(os.path.join(input_dir, str(year)+name[4:]))
        if (len(image_stack)==10):
            break

    if (len(image_stack)<10):
        return

    print("Computing historical anomaly for %s dataset"%name)
    
    import gdal
    import osr
    import ogr
    import numpy as np
    from functools import reduce
    rasters = [gdal.Open(file_path) for file_path in image_stack]
    current_raster = gdal.Open(os.path.join(input_dir,name))

    ysize = rasters[0].RasterYSize
    xsize = rasters[0].RasterXSize
    GeoT = rasters[0].GetGeoTransform()
    Projection = rasters[0].GetProjection()
    NDV = rasters[0].GetRasterBand(1).GetNoDataValue()

    bands = [raster.GetRasterBand(1) for raster in rasters]
    array_rasters = [band.ReadAsArray() for band in bands]
    array_sum = np.sum(array_rasters, axis=0)
    array_mean = array_sum / 10
    array_std = np.zeros((ysize, xsize))
    for raster in array_rasters:
        array_std += (raster - array_mean)**2
        del (raster)
    array_std = np.sqrt(array_std/10)

    del(rasters)
    del(bands)
    del(array_rasters)
    gc.collect()

    current_value = current_raster.GetRasterBand(1).ReadAsArray()
    array_out = (array_mean - current_value)/array_std
    # array_std = ((array_sum ** 2)/10 - (array_mean)**2)

    array_out[current_value == NDV] = NDV

    new_file_name = name
    driver = gdal.GetDriverByName('GTiff')
    DataSet = driver.Create(os.path.join(output_dir, new_file_name), xsize, ysize, 1, gdal.GDT_Byte)
    DataSet.SetGeoTransform(GeoT)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    DataSet.SetProjection(srs.ExportToWkt())

    DataSet.GetRasterBand(1).WriteArray(array_out)
    DataSet.GetRasterBand(1).SetNoDataValue(NDV)
    DataSet.FlushCache()

    DataSet = None

    print ("created anomaly file %s"%new_file_name)
    return

def init():
    # for dekad
    input_dir =  os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[0])
    anomaly_folder = create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,ANOMALY_FOLDER_PREFIX+FOLDER_SUFFIX[0]))
    all_files = os.listdir(input_dir)
    tif_files = [file for file in all_files if file.endswith(".tif")]
    for file in tif_files:
        create_anomaly_raster(file,input_dir, anomaly_folder)
    print ("dekad dataset up-to date")

    # for monthly
    input_dir =  os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[1])
    anomaly_folder = create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,ANOMALY_FOLDER_PREFIX+FOLDER_SUFFIX[1]))
    all_files = os.listdir(input_dir)
    tif_files = [file for file in all_files if file.endswith(".tif")]
    for file in tif_files:
        create_anomaly_raster(file,input_dir, anomaly_folder)
    print ("monthly dataset up-to date")

    # for 3 monthly
    input_dir =  os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[2])
    anomaly_folder = create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,ANOMALY_FOLDER_PREFIX+FOLDER_SUFFIX[2]))
    all_files = os.listdir(input_dir)
    tif_files = [file for file in all_files if file.endswith(".tif")]
    for file in tif_files:
        create_anomaly_raster(file,input_dir, anomaly_folder)
    print ("3 monthly dataset up-to date")


if __name__ == "__main__":
    from datetime import datetime
    start = datetime.now()
    init()
    print(datetime.now()-start)
