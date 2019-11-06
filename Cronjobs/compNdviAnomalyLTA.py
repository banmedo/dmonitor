## global imports
import os
import gc

## config
FOLDER_SUFFIX = ["_dd","_mm","_3m"]
NDVI_FODLER_PREFIX =  "emodisNdvi"
ANOMALY_FOLDER_PREFIX = "ndviAnomaly"
LTA_FOLDER = "LTA"
LTSD_FOLDER = "LTSD"
DOWNLOAD_FOLDER = "e:/ndvi/"

## functions
def create_if_not_exists(path):
    if (not os.path.exists(path)):
        os.mkdir(path)
    return path

def create_anomaly_raster(name, input_dir, output_dir, LTA_dir, LTSD_dir):
    # epoch_start = 2002
    # this_year = int(name[:4])
    #
    if (os.path.exists(os.path.join(output_dir,name))):
        print("Anomaly file %s already exists"%name)
        return

    # suffix = name[4:name.find('.')]
    suffix = name[4:]

    import gdal
    import osr
    import ogr
    import numpy as np
    from functools import reduce
    current_raster = gdal.Open(os.path.join(input_dir,name))
    LTA_raster = gdal.Open(os.path.join(LTA_dir,suffix))
    LTA_NDV = LTA_raster.GetRasterBand(1).GetNoDataValue() or -9999
    LTA_value = LTA_raster.GetRasterBand(1).ReadAsArray()
    LTSD_raster = gdal.Open(os.path.join(LTSD_dir,suffix))
    LTSD_value = LTSD_raster.GetRasterBand(1).ReadAsArray()

    ysize = current_raster.RasterYSize
    xsize = current_raster.RasterXSize
    GeoT = current_raster.GetGeoTransform()
    Projection = current_raster.GetProjection()
    NDV = current_raster.GetRasterBand(1).GetNoDataValue()

    current_value = current_raster.GetRasterBand(1).ReadAsArray()
    array_out = (LTA_value - current_value)/LTSD_value

    array_out[current_value == NDV] = NDV
    array_out[LTSD_value == LTA_NDV] = NDV

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
    LTA_dir =  os.path.join(DOWNLOAD_FOLDER,LTA_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[0])
    LTSD_dir =  os.path.join(DOWNLOAD_FOLDER,LTSD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[0])
    anomaly_folder = create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,ANOMALY_FOLDER_PREFIX+FOLDER_SUFFIX[0]))
    all_files = os.listdir(input_dir)
    tif_files = [file for file in all_files if file.endswith(".tif")]
    for file in tif_files:
        create_anomaly_raster(file, input_dir, anomaly_folder, LTA_dir, LTSD_dir)
    print ("dekad dataset up-to date")

    # for monthly
    input_dir =  os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[1])
    LTA_dir =  os.path.join(DOWNLOAD_FOLDER,LTA_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[1])
    LTSD_dir =  os.path.join(DOWNLOAD_FOLDER,LTSD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[1])
    anomaly_folder = create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,ANOMALY_FOLDER_PREFIX+FOLDER_SUFFIX[1]))
    all_files = os.listdir(input_dir)
    tif_files = [file for file in all_files if file.endswith(".tif")]
    for file in tif_files:
        create_anomaly_raster(file,input_dir, anomaly_folder, LTA_dir, LTSD_dir)
    print ("monthly dataset up-to date")

    # for 3 monthly
    input_dir =  os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[2])
    LTA_dir =  os.path.join(DOWNLOAD_FOLDER,LTA_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[2])
    LTSD_dir =  os.path.join(DOWNLOAD_FOLDER,LTSD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[2])
    anomaly_folder = create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,ANOMALY_FOLDER_PREFIX+FOLDER_SUFFIX[2]))
    all_files = os.listdir(input_dir)
    tif_files = [file for file in all_files if file.endswith(".tif")]
    for file in tif_files:
        create_anomaly_raster(file,input_dir, anomaly_folder, LTA_dir, LTSD_dir)
    print ("3 monthly dataset up-to date")


if __name__ == "__main__":
    from datetime import datetime
    start = datetime.now()
    init()
    print(datetime.now()-start)
