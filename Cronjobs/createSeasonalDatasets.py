# imports
import os
import gdal
import osr
import ogr
import numpy as np
from functools import reduce
import netCDF4

rootpath = 'Z:\\'
exportpath = 'E:\\SLDAS\\aggregates'
variableList = ['rain','tempMax','evap','soilMoist','temp']


## functions
def create_if_not_exists(path):
    if (not os.path.exists(path)):
        os.mkdir(path)
    return path

def runFor(variable):

    folderPath = create_if_not_exists(os.path.join(rootpath,variable+"_mm"))

    startyear = 2001
    endyear = 2018

    stack = []
    for startmonth in range(1, 13):
        innerstack = []
        for endmonth in range (1, 13):
            filelist = []
            if (endmonth < startmonth):
                endmonth = endmonth+12
            for month in range(startmonth, endmonth+1):
                if (month > 12):
                    month = month - 12
                filelist.append(month)
            innerstack.append(filelist)
        stack.append(innerstack)
    # print stack

    for innerstack in stack:
        for filelist in innerstack:
            print("processing",filelist);
            endmonth = filelist[len(filelist)-1]
            startmonth = filelist[0]

            # open one for image info
            testrast = gdal.Open(os.path.join(folderPath,str(endyear)+"%02d.tif"%(startmonth)))
            # get raster information
            ysize = testrast.RasterYSize
            xsize = testrast.RasterXSize
            GeoT = testrast.GetGeoTransform()
            Projection = testrast.GetProjection()
            NDV = testrast.GetRasterBand(1).GetNoDataValue()
            # print(NDV)
            # print(Projection)
            # get global mask
            mask = testrast.GetRasterBand(1).ReadAsArray() == NDV

            #variables for nc file
            y = np.arange(ysize)*GeoT[5]+GeoT[3]
            x = np.arange(xsize)*GeoT[1]+GeoT[0]

            image_stack = []

            # get stack of images from year 2001 to 2018
            for year in range(startyear,endyear+1):
                substack = []
                # include months from startmonth to endmonth
                for month in filelist:
                    # print ("month", month)
                    # add image to the stack
                    substack.append(os.path.join(folderPath,str(year)+"%02d.tif"%(month)));
                    # print('skipping ',os.path.join(folderPath,str(year)+"%02d.tif"%(month)));
                # read all the rasters in the image_stack
                rasters = []
                for file in substack:
                    ds = gdal.Open(file)
                    if (ds is None):
                        print("couldn't open ", file)
                    else:
                        rasters.append(ds)

                if (len(rasters)==0):
                    continue
                # print(len(rasters))
                #since rasters are of single bands, get those bands for operation
                bands = [raster.GetRasterBand(1) for raster in rasters]
                #convert the bands to numpy arrays
                subarrays = [band.ReadAsArray() for band in bands]
                # arrays[arrays == NDV] = 0
                subarray_sum = np.sum(subarrays, axis=0)
                image_stack.append(subarray_sum)

            array_sum = np.sum(image_stack, axis=0)
            years = endyear-startyear+1

            array_mean = array_sum / years
            array_sd = np.zeros((ysize,xsize))
            for raster in image_stack:
                array_sd += (raster-array_mean)**2
                del (raster)

            array_sd = np.sqrt(array_sd/years)
            array_sd [mask] = NDV

            exportfolder = create_if_not_exists(os.path.join(exportpath,variable))
            meanfolder = create_if_not_exists(os.path.join(exportfolder,"mean"))
            sdfolder = create_if_not_exists(os.path.join(exportfolder,"sd"))

            # export mean
            filename = os.path.join(meanfolder,"%02d%02d.nc"%(startmonth,endmonth))
            meanfile = netCDF4.Dataset(filename,'w',clobber=True)
            meanfile.createDimension('time',None)
            meanfile.createDimension('latitude',ysize)
            meanfile.createDimension('longitude',xsize)
            crs = meanfile.createVariable('spatial_ref', 'i4')
            crs.spatial_ref = Projection
            #container for time -- it is ignored anyways
            times = meanfile.createVariable('time','f8',('time',))
            #container for latitude
            lat = meanfile.createVariable('latitude','f4',('latitude',))
            lat.units = 'degrees_north'
            lat.standard_name = 'latitude'
            #container for longitude
            lon = meanfile.createVariable('longitude','f4',('longitude',))
            lon.units = 'degrees_east'
            lon.standard_name = 'longitude'
            #container for value
            values = meanfile.createVariable(variable,'f4',('time','latitude','longitude',),fill_value=NDV)
            values.standard_name = variable+'_mean'
            values.grid_mapping = 'spatial_ref'
            #write lat long
            lon[:] = x
            lat[:] = y
            values[0,:,:] = array_mean
            meanfile.close()

            # export sd
            filename = os.path.join(sdfolder,"%02d%02d.nc"%(startmonth,endmonth))
            sdfile = netCDF4.Dataset(filename,'w',clobber=True)
            sdfile.createDimension('time',None)
            sdfile.createDimension('latitude',ysize)
            sdfile.createDimension('longitude',xsize)
            crs = sdfile.createVariable('spatial_ref', 'i4')
            crs.spatial_ref = Projection
            #container for time -- it is ignored anyways
            times = sdfile.createVariable('time','f8',('time',))
            #container for latitude
            lat = sdfile.createVariable('latitude','f4',('latitude',))
            lat.units = 'degrees_north'
            lat.standard_name = 'latitude'
            #container for longitude
            lon = sdfile.createVariable('longitude','f4',('longitude',))
            lon.units = 'degrees_east'
            lon.standard_name = 'longitude'
            #container for value
            values = sdfile.createVariable(variable,'f4',('time','latitude','longitude',),fill_value=NDV)
            values.standard_name = variable+'_sd'
            values.grid_mapping = 'spatial_ref'
            #write lat long
            lon[:] = x
            lat[:] = y
            values[0,:,:] = array_sd
            sdfile.close()

            del(array_mean)
            del(array_sd)
            del(image_stack)
            del(substack)
            del(array_sum)

for variable in variableList:
    print('Running for '+variable);
    runFor(variable);
    print('Completed for '+variable);
