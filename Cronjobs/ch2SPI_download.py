#!/usr/bin/python

import datetime
import os
import re
from multiprocessing import Pool
import ftplib

#import click
import requests
from bs4 import BeautifulSoup

#------------------------------------------------configurations

BASE_URL = 'ftp.chg.ucsb.edu'
DEKADAL = "/pub/org/chg/products/CHIRPS-2.0/global_dekad_EWX/zscore/"
MONTHLY = "/pub/org/chg/products/CHIRPS-2.0/global_monthly_EWX/zscore/"
TRI_MONTHLY = "/pub/org/chg/products/CHIRPS-2.0/global_3-monthly_EWX/zscore/"
FOLDER_SUFFIX = ["_dd","_mm","_3m"]
NDVI_FODLER_PREFIX =  "ch2Spi"

DOWNLOAD_FOLDER = 'e:/nkdev/dtest/'
NO_OF_THREADS = 9

#----------------------------------------------------------------#
#-----------------------functions-DO NOT EDIT--------------------#
#----------------------------------------------------------------#


def get_ftp_connection(url, folder):
    ftp = ftplib.FTP(url,"anonymous","password")
    ftp.cwd(folder)
    return ftp

def requested_files_regex(file_types):
    regex = '.*('+file_types+ ')$'
    return re.compile(regex, re.IGNORECASE)

def files_start_with(prefix):
    regex = prefix+'.*'
    return re.compile(regex, re.IGNORECASE)

def get_standard_name(base_name, dekadal):
    if (not dekadal):
        return base_name[7:11]+base_name[12:-1]
    else:
        return base_name[7:11]+base_name[12:14]+'0'+base_name[14:-1]

def create_if_not_exists(path):
    if (not os.path.exists(path)):
        os.mkdir(path)
    return path

def truncate_data(name, download_folder):
    url = os.path.join(download_folder, name)
    import gdal
    import osr
    import ogr
    import numpy as np
    from functools import reduce
    raster = gdal.Open(url)

    ysize = raster.RasterYSize
    xsize = raster.RasterXSize
    GeoT = raster.GetGeoTransform()
    Projection = raster.GetProjection()
    noData = raster.GetRasterBand(1).GetNoDataValue()
    NDV = -9999
    # print(xsize, ysize, GeoT, Projection, NDV)

    band = raster.GetRasterBand(1)
    array_raster = band.ReadAsArray()
    array_raster[array_raster < -3] = NDV
    array_raster[array_raster > 3] = NDV
    array_raster[array_raster == noData] = NDV

    raster = None
    os.remove(url)
    driver = gdal.GetDriverByName('GTiff')
    DataSet = driver.Create(url, xsize, ysize, 1, gdal.GDT_Float32)
    DataSet.SetGeoTransform(GeoT)
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    DataSet.SetProjection(srs.ExportToWkt())

    DataSet.GetRasterBand(1).WriteArray(array_raster)
    DataSet.GetRasterBand(1).SetNoDataValue(NDV)
    DataSet.FlushCache()
    DataSet = None

    print ("Truncated file %s"%name)

def get_from_ch2(name, url, ftp_folder, download_folder, dekadal):
    new_name = get_standard_name(name, dekadal)
    if (not os.path.exists(os.path.join(download_folder,new_name))):
        print ("DOWNLOADING FILE %s"%new_name)
        new_file = open(os.path.join(download_folder,new_name),'wb')
        ftp = get_ftp_connection(url, ftp_folder)
        ftp.retrbinary('RETR %s'%name, new_file.write)
        new_file.close()
        print ("DOWNLOADED %s"%new_name)
        truncate_data(new_name, download_folder)
    else:
        print ("FILE %s EXISTS"%new_name)
    return new_name

def download_new_spi_files(file_list, url, ftp_folder, download_folder, dekadal = False):
    p = Pool(NO_OF_THREADS)
    print(sorted(file_list)[:2])
    p_res = [
        p.apply_async(
            get_from_ch2,
            (name, url, ftp_folder, download_folder, dekadal)
        ) for name in sorted(file_list)[:2]
    ]
    new_files = [res.get() for res in p_res]
    return new_files

def get_file_list(url, folder):
    ftp = get_ftp_connection(url, folder)
    all_files = ftp.nlst()
    regex = files_start_with('zscore');
    requested_files = list(filter(regex.match, all_files))
    return requested_files

def get_new_files(file_list, download_folder, dekadal = False):
    new_files = []
    for name in sorted(file_list):
        if not (os.path.exists(os.path.join(download_folder,get_standard_name(name, dekadal)))):
            new_files.append(name)
    return new_files

def init():
    # for downloading monthly data
    file_list = get_file_list(BASE_URL, DEKADAL)
    current_download_folder =  create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[0]))
    new_files = get_new_files(file_list, current_download_folder, True)
    downloaded_files = download_new_spi_files(new_files, BASE_URL, DEKADAL, current_download_folder, True)

    # for downloading monthly data
    file_list = get_file_list(BASE_URL, MONTHLY)
    current_download_folder =  create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[1]))
    new_files = get_new_files(file_list, current_download_folder)
    downloaded_files = download_new_spi_files(new_files, BASE_URL, MONTHLY, current_download_folder)

    # for downloading monthly data
    file_list = get_file_list(BASE_URL, TRI_MONTHLY)
    current_download_folder =  create_if_not_exists(os.path.join(DOWNLOAD_FOLDER,NDVI_FODLER_PREFIX+FOLDER_SUFFIX[2]))
    new_files = get_new_files(file_list, current_download_folder)
    downloaded_files = download_new_spi_files(new_files, BASE_URL, TRI_MONTHLY, current_download_folder)


if __name__ == '__main__':
    init()
