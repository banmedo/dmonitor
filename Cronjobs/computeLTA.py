# imports
import os
import gdal
import osr
import ogr
import numpy as np

rootpath = 'Z:\\'
exportPath = "E:\\SLDAS"
variableList = ['evap','rain','soilMoist','temp','tempMax', 'tempMin']

def create_if_not_exists(path):
    if (not os.path.exists(path)):
        os.mkdir(path)
    return path

def exportHelper(array_out, output_dir, name, xsize, ysize, GeoT, NDV):
    new_file_name = name
    driver = gdal.GetDriverByName('GTiff')
    DataSet = driver.Create(os.path.join(output_dir, new_file_name), xsize, ysize, 1, gdal.GDT_Float32)
    DataSet.SetGeoTransform(GeoT)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    DataSet.SetProjection(srs.ExportToWkt())

    DataSet.GetRasterBand(1).WriteArray(array_out)
    DataSet.GetRasterBand(1).SetNoDataValue(NDV)
    DataSet.FlushCache()

    DataSet = None
    print ("created file %s"%new_file_name)


for variable in variableList:
    for month in range (1,13):
        fl_mm = []
        fl_3m = []
        for year in range (2000,2019):
            folder = create_if_not_exists(os.path.join(rootpath,variable+"_mm"))
            inputfile = os.path.join(folder,"%04d%02d.tif"%(year,month))
            fl_mm.append(inputfile)

            monthafter = month+1
            monthafterthat = month+2
            inputfile = os.path.join(rootpath,variable+"_3m","%04d%02d%02d%02d.tif"%(year,month,monthafter,monthafterthat))
            fl_3m.append(inputfile)
        print("processing monthly files:",len(fl_mm))
        rasters = []
        for file in fl_mm:
            ds = gdal.Open(file)
            if (ds is None):
                print("couldn't open ", file)
            else:
                rasters.append(ds)

        sample_raster = rasters[0]
        ysize = sample_raster.RasterYSize
        xsize = sample_raster.RasterXSize
        GeoT = sample_raster.GetGeoTransform()
        Projection = sample_raster.GetProjection()
        NDV = sample_raster.GetRasterBand(1).GetNoDataValue()

        #since rasters are of single bands, get those bands for operation
        bands = [raster.GetRasterBand(1) for raster in rasters]
        #convert the bands to numpy arrays
        subarrays = [band.ReadAsArray() for band in bands]
        #now compute mean
        LTA = np.mean(subarrays,axis=0)

        LTSD = np.std(subarrays,axis=0)

        meanfolder = create_if_not_exists(os.path.join(exportPath,"LTA",variable+"_mm"))
        exportHelper(LTA, meanfolder, "%02d"%month, xsize, ysize, GeoT, NDV)

        sdfolder = create_if_not_exists(os.path.join(exportPath,"LTSD",variable+"_mm"))
        exportHelper(LTSD, sdfolder, "%02d"%month, xsize, ysize, GeoT, NDV)

        print("processing 3 monthly files:",len(fl_3m))
        rasters = []
        for file in fl_3m:
            ds = gdal.Open(file)
            if (ds is None):
                print("couldn't open ", file)
            else:
                rasters.append(ds)

        sample_raster = rasters[0]
        ysize = sample_raster.RasterYSize
        xsize = sample_raster.RasterXSize
        GeoT = sample_raster.GetGeoTransform()
        Projection = sample_raster.GetProjection()
        NDV = sample_raster.GetRasterBand(1).GetNoDataValue()

        #since rasters are of single bands, get those bands for operation
        bands = [raster.GetRasterBand(1) for raster in rasters]
        #convert the bands to numpy arrays
        subarrays = [band.ReadAsArray() for band in bands]
        #now compute mean
        LTA = np.mean(subarrays,axis=0)

        LTSD = np.std(subarrays,axis=0)

        meanfolder = create_if_not_exists(os.path.join(exportPath,"LTA",variable+"_3m"))
        exportHelper(LTA, meanfolder, "%02d%02d%02d"%(month,monthafter,monthafterthat), xsize, ysize, GeoT, NDV)

        sdfolder = create_if_not_exists(os.path.join(exportPath,"LTSD",variable+"_3m"))
        exportHelper(LTSD, sdfolder, "%02d%02d%02d"%(month,monthafter,monthafterthat), xsize, ysize, GeoT, NDV)
