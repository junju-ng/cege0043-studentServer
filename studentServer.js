// express is the server that forms part of the nodejs program
var express = require('express');
var path = require("path");
var app = express(); // set up app to run server using express API

// add an http server to serve files to the Edge browser
// due to certificate issues it rejects the https files if they are not
// directly called in a typed URL

var http = require('http');
var httpServer = http.createServer(app); // create server with the app
httpServer.listen(4480);

// serving text
app.get('/', function(req, res){
	// server-side code
	console.log("The server has received a request.");
	res.send("hello world from the HTTP server");
});

// serving file - can serve any file
app.get('/:fileName', function(req, res){
	// server-side code
	var fileName = req.params.fileName;
	console.log(fileName + ' requested');
	// __dirname gives the path to the studentServer.js file
	res.sendFile(__dirname + '/' + fileName);
});


// add functionality to log requests
app.use(function(req, res, next){
	var filename = path.basename(req.url);
	var extension = path.extname(filename);
	console.log("The file " + filename + " was requested.");
	next();
});