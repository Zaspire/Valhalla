#!/bin/bash

yum install nginx
cp configs/nginx.conf /etc/nginx/nginx.conf
systemctl enable nginx.service
service nginx start
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
