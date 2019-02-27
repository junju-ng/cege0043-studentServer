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

var bodyParser = require('body-parser'); // add bodyparser to process uploaded data
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

// import required database connectivity and set up database connection
var fs = require('fs');
var pg = require('pg');

var configtext = ""+fs.readFileSync("/home/studentuser/certs/postGISConnection.js");

// convert configuration file into name/value pair array
var configarray = configtext.split(","); // comma as delimiter
var config = {};
for (var i = 0; i < configarray.length; i++){
	var split = configarray[i].split(":"); // separate using :
	config[split[0].trim()] = split[1].trim();
}

var pool = new pg.Pool(config);

// app.get to test database connection
app.get('/postgistest', function(req, res){
	pool.connect(function(err, client, done){
		if (err) {
			// log, and send error to client if there is an error getting a connection
			console.log("not able to get connection " + err);
			res.status(400).send(err);
		}
		// send a query
		client.query('SELECT name FROM london_poi', function(err, result){
			done();
			if (err){
				// if query is not successful, send error to client
				console.log(err);
				res.status(400).send(err);
			}
			// if query is successful, send results to client
			res.status(200).send(result.rows);
		});
	});
});


// serving text
app.get('/', function(req, res){
	// server-side code
	console.log("The server has received a request.");
	res.send("hello world from the HTTP server");
});

// add functionality to log requests
app.use(function(req, res, next){
	var filename = path.basename(req.url);
	var extension = path.extname(filename);
	console.log("The file " + filename + " was requested.");
	next();
});

app.use(function(req, res, next){
	res.header("Access-Control-Allow-Origin","*");
	res.header("Access-Control-Allow-Headers","X-Requested-With");
	next();
});

// serve static files - e.g. html, css
// should be the last line in the server
app.use(express.static(__dirname));