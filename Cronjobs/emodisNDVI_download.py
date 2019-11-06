#!/usr/bin/python

import datetime
import os
import re
from multiprocessing import Pool

#import click
import requests
from bs4 import BeautifulSoup

#------------------------------------------------configurations

BASE_URL = 'https://edcintl.cr.usgs.gov/downloads/sciweb1/shared/fews/web/asia/centralasia/dekadal/emodis/ndvi_c6/temporallysmoothedndvi/downloads/'
DEKADAL = 'dekadal/'
MONTHLY = 'monthly/'
FOLDER_SUFFIX = ["_dd","_mm","_3m"]
NDVI_FODLER_PREFIX =  "emodisNdvi"
DOWNLOAD_FOLDER = 'e:/ndvi/'
NO_OF_THREADS = 20

#----------------------------------------------------------------#
#-----------------------functions-DO NOT EDIT--------------------#
#----------------------------------------------------------------#

def requested_files_regex(file_types):
    regex = '.*('+file_types+ ')$'
    return re.compile(regex, re.IGNORECASE)

def get_base_name(name):
    return name[:-4]

def get_standard_tif_name(base_name):
    name_string = '20' + base_name[3:]
    year = name_string[:4]
    dek = int(name_string[-2:])
    month = (dek - 1) / 3 + 1
    m_dek = (dek - 1) % 3 + 1
    name = "%s%02d%02d"%(year,month,m_dek)
    return name+'.tif'

def create_if_not_exists(path):
    if (not os.path.exists(path)):
        os.mkdir(path)
    return path

def download_file_public(name, url, download_folder):
    import requests
    headers = requests.head(url).headers
    if ('Content-length' in headers.keys()):
        file_size = int(headers['Content-Length'])
    else:
        file_size = -1
    file_name = os.path.join(download_folder, name)
    print ('Downloading file %s of size %d'%(file_name,file_size))
    if not os.path.isfile(file_name) or os.path.getsize(file_name) != file_size:
        response = requests.get(url, stream=True)
        with open(file_name, 'wb') as f:
            for chunk in response.iter_content(chunk_size=2000000):
                f.write(chunk)
        if response.status_code is 200:
            print('Successfully downloaded: ' + name)
        else:
            print('Download for: ' + name + ' failed')
    else:
        print('File: ' + name + ' already downloaded')


def get_from_emodis(name, url, download_folder):
    file_download = download_file_public(name, url, download_folder)
    import zipfile
    downloaded_zip = zipfile.ZipFile(os.path.join(download_folder,name),'r')
    downloaded_zip.extractall(download_folder)
    name_noext = get_base_name(name)
    try:
        os.rename(os.path.join(download_folder,name_noext+'.tif'),os.path.join(download_folder,get_standard_tif_name(name_noext)))
        os.remove(os.path.join(download_folder,name_noext+'.tfw'))
    except:
        os.rename(os.path.join(download_folder,name_noext+'m.tif'),os.path.join(download_folder,get_standard_tif_name(name_noext)))
        os.remove(os.path.join(download_folder,name_noext+'m.tfw'))
    downloaded_zip.close()
    os.remove(os.path.join(download_folder,name))
    print ('Completed procedure for file %s'%name)
    return name

def download_new_emodis_files(file_list, download_folder):
    p = Pool(NO_OF_THREADS)
    p_res = [
        p.apply_async(
            get_from_emodis,
            (name, url, download_folder)
        ) for name, url in sorted(file_list.items())
    ]
    new_files = [res.get() for res in p_res]
    return [new_file for new_file in new_files if new_file is not None]


def get_file_list(url):
    files = {}
    index_dir_url = url
    file_links = BeautifulSoup(
        requests.get(index_dir_url).text, 'html.parser'
    ).find_all(
        'a', text=requested_files_regex(".zip")
    )
    [
        files.update({link.text: index_dir_url + link.attrs['href']})
        for link in file_links
    ]
    return files

def get_new_files(file_list, download_folder):
    new_files = {}
    for name, url in sorted(file_list.items()):
        name_noext = get_base_name(name)
        if not (os.path.exists(os.path.join(download_folder,get_standard_tif_name(name_noext)))):
            new_files[name] = url
    return new_files

def create_max_raster(input_dir, raster_list,output_dir, new_file_name):
    import gdal
    import osr
    import ogr
    import numpy as np
    from functools import reduce
    rasters = [gdal.Open(os.path.join(input_dir, raster)) for raster in raster_list]

    ysize = rasters[0].RasterYSize
    xsize = rasters[0].RasterXSize
    GeoT = rasters[0].GetGeoTransform()
    Projection = rasters[0].GetProjection()
    NDV = rasters[0].GetRasterBand(1).GetNoDataValue()

    bands = [raster.GetRasterBand(1) for raster in rasters]
    array_rasters = [band.ReadAsArray() for band in bands]
    array_out = reduce(np.maximum, array_rasters)

    driver = gdal.GetDriverByName('GTiff')
    DataSet = driver.Create(os.path.join(output_dir, new_file_name), xsize, ysize, 1, gdal.GDT_Int16)
    DataSet.SetGeoTransform(GeoT)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    DataSet.SetProjection(srs.ExportToWkt())

    DataSet.GetRasterBand(1).WriteArray(array_out)
    DataSet.GetRasterBand(1).SetNoDataValue(NDV)
    DataSet.FlushCache()

    DataSet = None

    print ("created file %s"%new_file_name)

def aggregare_emodis_monthly(input_dir, new_file, output_dir):
    base_name = get_base_name(new_file)
    base_dekad = int(base_name[-2:])
    if (base_dekad % 3 == 0):
        file_name_no_ext = get_base_name(get_standard_tif_name(base_name))
        raster1 = "%d.tif"%(int(file_name_no_ext)-2)
        raster2 = "%d.tif"%(int(file_name_no_ext)-1)
        raster3 = "%s.tif"%file_name_no_ext
        if (not os.path.exists(os.path.join(input_dir, raster1))) or (not os.path.exists(os.path.join(input_dir, raster2))) or (not os.path.exists(os.path.join(input_dir, raster2))):
            print ("%s %s %s some files missing"%(raster1, raster2, raster3))
            return

        year = file_name_no_ext[:4]
        month = file_name_no_ext[4:6]
        new_file_name = "%s%s.tif"%(year,month)


        if (os.path.exists(os.path.join(output_dir, new_file_name))):
            print ("Monthly dataset %s already exists"%new_file_name)
        else:
            create_max_raster(input_dir, [raster1,raster2,raster3], output_dir, new_file_name)

        return new_file_name

def get_emodis_monthly(input_dir, new_files, output_dir):
    p = Pool(NO_OF_THREADS)
    p_res = [
        p.apply_async(
            aggregare_emodis_monthly,
            (input_dir, new_file, output_dir)
        ) for new_file in new_files
    ]
    new_files = [res.get() for res in p_res]
    return [new_file for new_file in new_files if new_file is not None]

def aggregare_emodis_3monthly(input_dir, new_file, output_dir):
    file_name_no_ext = get_base_name(new_file)
    base_year1 = base_year2 = base_year = int(file_name_no_ext[:4])
    base_month = int(file_name_no_ext[-2:])
    month1 = base_month-2
    month2 = base_month-1
    if (base_month == 1):
        month1 = 11
        month2 = 12
        base_year1 = base_year-1
        base_year2 = base_year-1
    elif (base_month == 2):
        month1 = 12
        base_year1 = base_year-1

    raster1 = "%04d%02d.tif"%(base_year,month1)
    raster2 = "%04d%02d.tif"%(base_year,month2)
    raster3 = "%s.tif"%file_name_no_ext
    if (not os.path.exists(os.path.join(input_dir, raster1))) or (not os.path.exists(os.path.join(input_dir, raster2))) or (not os.path.exists(os.path.join(input_dir, raster2))):
        print ("%s %s %s some files missing"%(raster1, raster2, raster3))
        return

    new_file_name = "%04d%02d%02d%02d.tif"%(base_year1,month1, month2, base_month)

    if (os.path.exists(os.path.join(output_dir, new_file_name))):
        print ("3 Monthly dataset %s already exists"%new_file_name)
    else:
        create_max_raster(input_dir, [raster1,raster2,raster3], output_dir, new_file_name)

    return new_file_name

def get_emodis_3monthly(input_dir, new_files, output_dir):
    p = Pool(NO_OF_THREADS)
    p_res = [
        p.apply_async(
            aggregare_emodis_3monthly,
            (input_dir, new_file, output_dir)
        ) for new_file in new_files
    ]
    new_files = [res.get() for res in p_res]
    return [new_file for new_file in new_files if new_file is not None]

def init():
    # for downloading dekadal data
    file_list = get_file_list(os.path.join(BASE_URL,DEKADAL))
    # file_list  = {'cta0219.zip':'https://edcintl.cr.usgs.gov/downloads/sciweb1/shared/fews/web/asia/centralasia/dekadal/emodis/ndvi_c6/temporallysmoothedndvi/downloads/dekadal/cta0219.zip','cta0220.zip':'https://edcintl.cr.usgs.gov/downloads/sciweb1/shared/fews/web/asia/centralasia/dekadal/emodis/ndvi_c6/temporallysmoothedndvi/downloads/dekadal/cta0220.zip'}
    current_download_folder =  create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[0]))
    new_files = get_new_files(file_list, current_download_folder)
    downloaded_files = download_new_emodis_files(new_files, current_download_folder)

    #compute monthly if good dekadal
    new_files = sorted(downloaded_files)
    # print(new_files)
    monthly_folder = create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[1]))
    new_monthly_files = get_emodis_monthly(current_download_folder, new_files, monthly_folder)

    #compute monthly if good dekadal
    tri_monthly_folder = create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[2]))
    get_emodis_3monthly(monthly_folder, new_monthly_files, tri_monthly_folder)


if __name__ == '__main__':
    init()
