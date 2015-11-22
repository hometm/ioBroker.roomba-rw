/**
 *
 * example adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "example",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js Example Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@example.com>"
 *          ]
 *          "desc":         "Example adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42
 *      }
 *  }
 *
 */


"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

var net = require('net');
var client = new net.Socket();
var statusIntervall;
var distanceCurrentVectorMm=0;
var distanceTarget=0;
var angleCurrentVectorDegree=0;
var distanceAngle=0;
var manualControlDriveSpeed=0;
var manualControlRotateSpeed=0;

var enMainBrush=false;
var enSideBrush=false;
var enVacuum=false;


//StatusData
var sBumpsWheeldrops=0xff;
var sWall=0xff;
var sCliffLeft=0xff;
var sCliffFrontLeft=0xff;
var sCliffFrontRight=0xff;
var sCliffRight=0xff;
var sVirtualWall=0xff;
var sMotorOvercurrents=0xff;
var sDirtDetectorLeft;
var sDirtDetectorRight;
var sRemoteControlCommand;
var sButtons;
var sDistance;
var sAngle;
var sChargingState;
var sVoltage;
var sCurrent;
var sTemperature;
var sCharge;
var sCapacity;

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.example.0
var adapter = utils.adapter('roomba-rw');



// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');

        if(statusIntervall)
            clearInterval( statusIntervall);
        if(client)
            client.end();

        callback();
    } catch (e) {
        callback();
    }
});


// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
   // adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        if (id == adapter.namespace + '.Inputs.SciCmd') {
            newCommand(id, state.val);
        } else if (id == adapter.namespace + '.Inputs.Clean') {
            newCommand(id, "0x87");
        } else if (id == adapter.namespace + '.Inputs.Spot') {
            newCommand(id, "0x86");
        } else if (id == adapter.namespace + '.Inputs.Dock') {
            newCommand(id, "0x8f");
        } else if (id == adapter.namespace + '.Inputs.Power') {
            newCommand(id, "0x85");
        } else if (id == adapter.namespace + '.Inputs.Drive.FW') {
            driveCmd(id, state.val);
        } else if (id == adapter.namespace + '.Inputs.Drive.BW') {
            driveCmd(id, state.val);
        } else if (id == adapter.namespace + '.Inputs.Drive.Stop') {
            driveCmd(id, state.val);
        } else if (id == adapter.namespace + '.Inputs.Drive.RCW') {
            driveCmd(id, state.val);
        } else if (id == adapter.namespace + '.Inputs.Drive.RCCW') {
            driveCmd(id, state.val);
        } else if (id == adapter.namespace + '.Inputs.Drive.DriveSpeed') {
            changeDriveSpeed(state.val);
        } else if (id == adapter.namespace + '.Inputs.Drive.RotateSpeed') {
            changeRotateSpeed(state.val);
        } else if (id == adapter.namespace + '.Inputs.ExportSensorData') {
            exportSensorData(state.val);
        }
    }
    if(!state.ack) {
        if(id == adapter.namespace + '.Inputs.Drive.MainBrush') {
            if(state.val!=enMainBrush)
                motorCmd(id, state.val);
        }else if(id == adapter.namespace + '.Inputs.Drive.SideBrush') {
            if(state.val!=enSideBrush)
                motorCmd(id, state.val);
        }else if(id == adapter.namespace + '.Inputs.Drive.Vacuum') {
            if(state.val!=enVacuum)
                motorCmd(id, state.val);
        }
    }
});


// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});





function main() {

    adapter.subscribeStates('*');

    // INIT
    client.connect(adapter.config.port, adapter.config.ip, function() {

        console.log('CONNECTED TO: ' + adapter.config.ip + ':' + adapter.config.port);
        client.setEncoding('hex');
    });


    client.on('data', function(data) {
        //console.log('DATA: ' + data);
        if (data[0] == 0 && (data.length % 26)==0)
            translateStatus(data);
        if (emergencyStop()) {
            console.log("emergencyStop");
            newCommand(null, '0x89 0x00 0x00 0x80 0x00');
        }
    });


    client.on('close', function() {
        console.log('Connection closed');
    });

    adapter.getState('Inputs.Drive.DriveSpeed', function(err, res){
        if(!res)
            manualControlDriveSpeed=0;
        else
            manualControlDriveSpeed=res.val;
        adapter.setState('Inputs.Drive.DriveSpeed',{val:manualControlDriveSpeed, ack:true});
    });

    adapter.getState('Inputs.Drive.RotateSpeed', function(err, res){
        if(!res)
            manualControlRotateSpeed=0;
        else
            manualControlRotateSpeed=res.val;
        adapter.setState('Inputs.Drive.RotateSpeed',{val:manualControlRotateSpeed, ack:true});
    });



    //Start communication
    setTimeout(function() {
        client.write(new Buffer([0x80]),//start in PASSIVE MODE
            function(){
                setTimeout(function(){client.write(new Buffer([0x83]));}, 500) //switch to SAFE MODE
            });
    }, 1000);


    statusIntervall=setInterval(readStatus, adapter.config.cycle);
}



function readStatus(){
    var buf=new Buffer([142, 0]);
    client.write(buf);
}

function translateStatus(dat) {
   // console.log('data:' + dat);
    var data = [];

    for (var i = 0; i < dat.length; i += 2) {
        data.push(parseInt('0x' + dat.substr(i, 2)));
    }

    //status "1"
    sBumpsWheeldrops = data[0] & 0x1c;
    sWall = data[0] & 0x03;
    sCliffLeft = data[2];
    sCliffFrontLeft = data[3];
    sCliffFrontRight = data[4];
    sCliffRight = data[5];
    sVirtualWall = data[6];
    sMotorOvercurrents = data[7];
    sDirtDetectorLeft = data[8];
    sDirtDetectorRight = data[9];
    //status "2"
    sRemoteControlCommand = data[10];
    sButtons = data[11];
    sDistance = 0xffff - ((data[12] * 256) + data[13]);
    sDistance *= 10;//spec says: distance in mm; test says: distance in cm
    distanceCurrentVectorMm += sDistance;
    sAngle = 0xffff - ((data[14] * 256) + data[15]);
    sAngle = (360 * sAngle) / 258 * Math.PI;
    angleCurrentVectorDegree += sAngle;
    //status "3"
    sChargingState = data[16];
    sVoltage = (data[17] * 256) + data[18];
    sCurrent = 0xffff - ((data[19] * 256) + data[20]);
    sTemperature = 0xff - data[21];
    sCharge = (data[22] * 256) + data[23];
    sCapacity = (data[24] * 256) + data[25];

    //Target distance reached
    if (distanceTarget > 0) {

        if (distanceCurrentVectorMm > 0) {
            //FORWARD
            if (distanceCurrentVectorMm >= distanceTarget) {
                //Target reached
                var cmd = '0x89 0x0 0x0 0x80 0x0'
                newCommand('', cmd);
            }
        } else if (distanceCurrentVectorMm < 0) {
            //BACKWARD
            if (distanceCurrentVectorMm <= distanceTarget) {
                //Target reached
                var cmd = '0x89 0x0 0x0 0x80 0x0'
                newCommand('', cmd);
            }
        }
    }

    //Target angel reached
    if(distanceAngle>0) {
        if (angleCurrentVectorDegree > 0) {
            //FORWARD
            if (angleCurrentVectorDegree >= distanceAngel) {
                //Target reached
                var cmd = '0x89 0x0 0x0 0x80 0x0'
                newCommand('', cmd);
            }
        } else if (angleCurrentVectorDegree < 0) {
            //BACKWARD
            if (angleCurrentVectorDegree <= distanceAngel) {
                //Target reached
                var cmd = '0x89 0x0 0x0 0x80 0x0'
                newCommand('', cmd);
            }
        }
    }
}


function emergencyStop()
{
    var r= sBumpsWheeldrops |
        sWall |
        sCliffLeft |
        sCliffFrontLeft |
        sCliffFrontRight |
        sCliffRight |
        sVirtualWall |
        sMotorOvercurrents;
    return r       ;
}

function driveCmd(id, value){
    if(id.indexOf('FW')>=0){
        var cmd='0x89 '+intToHex(manualControlDriveSpeed)+' 0x80 0x0';
        newCommand(id,value,cmd);
    } else if(id.indexOf('BW')>=0){
        var cmd='0x89 '+intToHex(manualControlDriveSpeed * -1)+' 0x80 0x0';
        newCommand(id,value,cmd);
    } else if(id.indexOf('Stop')>=0){
        var cmd='0x89 0x0 0x0 0x80 0x0';
        newCommand(id,value,cmd);
    } else if(id.indexOf('RCW')>=0){
        var cmd='0x89 '+intToHex(manualControlRotateSpeed)+' 0xFF 0xFF';
        newCommand(id,value,cmd);
    } else if(id.indexOf('RCCW')>=0){
        var cmd='0x89 '+intToHex(manualControlRotateSpeed)+' 0x00 0x1';
        newCommand(id,value,cmd);
    }
}

function motorCmd(id, value) {
    if (id.indexOf('MainBrush') > 0) {
        enMainBrush = value;
    } else if (id.indexOf('SideBrush') > 0) {
        enSideBrush = value;
    } else if (id.indexOf('Vacuum') > 0) {
        enVacuum = value;
    }

    var sendByte = 0;
    if (enMainBrush)
        sendByte += 0x04;
    if (enSideBrush)
        sendByte += 0x01;
    if (enVacuum)
        sendByte += 0x02;

    newCommand(id, value, "0x8A 0x" + sendByte.toString(16));
    adapter.setState(id, {val: value, ack: true});
}


function intToHex(intVal){
    var nV=intVal;
    if(intVal<0) {
        nV*=-1;
        nV = ~nV &0xffff ;
        nV=nV + 1;
    }
        var rtn = '0x' + (Math.floor(nV / 256)).toString(16) + ' 0x' + (nV % 256).toString(16);
        return rtn;

}

function newCommand(input, value, /*optional */ cmd){
    //input: input ro acknowledge (without adapter prefix)
    //value: value to acknowledge
    //cmd: command to send (0x12 0xab ..)

    if(!value)
        return;
    if(!cmd)
        cmd=value;

    //#ACK INPUT
    if(input)
        adapter.setState(input,{val:value, ack:true});

    //check, if a distance is set
    if(cmd.indexOf('D=')>-1){
        distanceTarget=cmd.substring( cmd.indexOf('D=')+2);
        if(!parseInt(distanceTarget))
            distanceTarget=0;
        cmd=cmd.substring(0,cmd.indexOf('D='));
    }
    //check, if a angel is set
    if(cmd.indexOf('A=')>-1){
        distanceAngle=cmd.substring( cmd.indexOf('A=')+2);
        if(!parseInt(distanceAngle))
            distanceAngle=0;
        cmd=cmd.substring(0,cmd.indexOf('A='));
    }

    //cmd: string -> (hex)ByteArray
    cmd=cmd.trim();
    cmd=cmd.split(/[ ]+/);

    if(cmd[0]==0x89){
        //Drive command. set distance target
        distanceCurrentVectorMm=0;
        angleCurrentVectorDegree=0;
    }

        var buf=new Buffer(cmd);
        client.write(buf);
}

function changeDriveSpeed(value){
    manualControlDriveSpeed=parseInt( value);
    adapter.setState('Inputs.Drive.DriveSpeed', {val:value, ack:true});
}

function changeRotateSpeed(value){
    manualControlRotateSpeed=parseInt( value);
    adapter.setState('Inputs.Drive.RotateSpeed', {val:value, ack:true});
}

function exportSensorData(value){
    //export some of the most interesting sensor data
    adapter.setState('Inputs.ExportSensorData',{val:value, ack:true});
    adapter.setState('Outputs.SVoltage',{val:sVoltage, ack:true});
    adapter.setState('Outputs.SCurrent',{val:sCurrent, ack:true});
    adapter.setState('Outputs.STemperature',{val:sTemperature, ack:true});
    adapter.setState('Outputs.SCharge',{val:sCharge, ack:true});
    adapter.setState('Outputs.SCapacity',{val:sCapacity, ack:true});
}