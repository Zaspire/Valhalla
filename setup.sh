#!/bin/bash

#mkdir /srv/www/Valhalla.git/; cd /srv/www/Valhalla.git/
#yum install git; git init; git config receive.denyCurrentBranch ignore
#git reset --hard

yum update
yum install nginx bash-completion npm mongodb mongodb-server firewalld git

systemctl enable firewalld
systemctl start firewalld
systemctl enable mongod
systemctl start mongod

cd /srv/www/Valhalla.git/
pushd server/; npm install; popd
pushd ai/; npm install; popd

ln -s /srv/www/Valhalla.git/configs/valhalla.service /etc/systemd/system/valhalla.service
ln -s /srv/www/Valhalla.git/configs/valhalla_ai.service /etc/systemd/system/valhalla_ai.service

systemctl enable valhalla
systemctl enable valhalla_ai
systemctl start valhalla
systemctl start valhalla_ai

firewall-cmd --zone=public --permanent --add-port 3000/tcp
firewall-cmd --reload

cp configs/nginx.conf /etc/nginx/nginx.conf
systemctl enable nginx.service
service nginx start
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
