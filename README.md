#Roomba-rw (Roomba RooWifi) Adapter for ioBroker

##Description:
ioBroker Adapter for monitoring/operation of Roomba cleaners over RooWifi. This adapter uses just the Roomba SCI 
interface. The RooWifi interface (http interface) can be used by an other application, vis or javascript.

Up to now, the following functionality is supported:  

* Direct commands for on-device-buttons (started by 'true')  
      * Power  
      * Dock  
      * Clean  
      * Spot  
* Input SciCmd for Roomba SCI commands  
* Export of sensor data (values, see SCI documentation), triggered by input ExportSensorData  
* Direct drive commands (enabled/disables by 'true'/'false')  
      * Forward (FW)  
      * Backward (BW)  
      * Rotate clockwise (RCW)  
      * Rotate counter clockwise (RCCW)  
      * Stop driving (Stop)  
      * Set drive speed (DriveSpeed)  
      * Set rotate speed (RotateSpeed)  
      * Main brush (MainBrush)  
      * Side brush (SideBrush)  
      * Vacuum (Vacuum)  
* Feedback SciCmdTargetReached is set, if target distance/angel ist reached  
* Outputs for most common sensor data (temperature, voltage, current,...) are present. The update of these outputs 
 can be triggered by ExportSensorData.  


###SCI Commands:  
Input SciCmd is used for execution of any SCI command. The following rules has to be applied:  

* Just one command at a time  
* The single bytes of the SCI command are written as hex values: e.g. 137(dec) -> 0x87  
* Seperate the different bytes by a blank: e.g. 0x89 0x0 0x0 0x80 0x0 (this pattern equals STOP command)  
* A distance target can be set by Parameter 'D='. This parameter needs a value in millimeters 
e.g. 0x89 0x0 0x64 0x80 0x00 D=1500 (move roomba forward command. Stopps automatically if target distance 1500mm is reached)  
* A angle target can be set by Parameter 'A='. This parameter needs a value in degrees 
e.g. 0x89 0x0 0x32 0xff 0xff A=-90 (rotate roomba clockwise. Stopps automatically if target angle -90deg is reached)  
* A delay of >20msec is required between different commands  
* No extra characters (commas, semicolon, quotes,..) are needed!  
* Roomba can be programmed for playing sounds :-)  

__Note on target distance/angle:__  
The SCI reading and calculation is based on multiple calculations with different sensors. This mathematical 
reproduction of the past physical movement can lead to an arithmetical error. The faster the drive/rotation speed, 
the bigger the arithmetical error!

###Configuration:  
The following configuration parameter are required inside ioBroker adapter configuration:  

* RooWifi IP address (e.g. 192.168.2.20)  
* RooWifi network port (default 9001)  
* State poll cycle in milliseconds (500 is a good value). In this cycle, the internal sensor vales are polled. A faster 
cycle leads to too much stess for the machine. A lower cycle leads to too bis arithmetical errors and delays in 
target distance/angle.  
* Username/password for Roomba  


##Prerequirements:
- [ioBroker](http://www.ioBroker.net "ioBroker homepage")



##Change log:


###0.0.1 (2015-09-22)
* Initial version

##LOP:  
* Init device  
* Re-init device (after device went to sleep)  
* Power on/off  
* Test  
* Improvement: rotation to a specified angle  
* Output of sensor values  
* Support of Roomba username/password  


