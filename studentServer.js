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

app.use(function(req, res, next){
	res.header("Access-Control-Allow-Origin","*");
	res.header("Access-Control-Allow-Headers","X-Requested-With");
	next();
});

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

// do POST request upload data to studentServer.js
app.post('/reflectData', function(req, res){
	// Using POST hence uploading data
	// parameters form part of BODY request c.f. RESTful API
	console.dir(req.body);
	
	// Echo request back to client
	res.send(req.body);
});

// add POST command that connects to the database and inserts a record into the formData table
app.post('/uploadData', function(req, res){
	// Using POST hence uploading data
	// parameters form part of BODY request c.f. RESTful API
	console.dir(req.body);
	
	pool.connect(function(err, client, done){
		// send error to client if unable to get connection
		if (err) {
			console.log("not able to get connection " + err);
			res.status(400).send(err);
		}
		// create variables for inserting record
		var name = req.body.name;
		var surname = req.body.surname;
		var module = req.body.module;
		var portnum = req.body.port_id;
		var language = req.body.language;
		var modulelist = req.body.modulelist;
		var lecturetime = req.body.lecturetime;
		
		var geometrystring = "st_geomfromtext('POINT("+req.body.longitude + " "+req.body.latitude + ")')";
		
		var querystring = "INSERT into formdata (name, surname, module, port_id, language, modulelist, lecturetime, geom) values ($1, $2, $3, $4, $5, $6, $7, ";
		querystring = querystring + geometrystring + ")";
		console.log(querystring);
		// client sends query
		client.query(querystring, [name, surname, module, portnum, language, modulelist, lecturetime], function(err, result){
			done(); // release client back into the pool
			// if unable to query client, raise error
			if (err){
				console.log(err)
				res.status(400).send(err);
			}
			res.status(200).send("row inserted"); // sucessfully inserted record in formdata
		});
	});
});


// get formData as geojson
app.get('/getFormData/:port_id',function(req, res){
	pool.connect(function(err, client, done){
		//raise error if unable to connect
		if (err){
			console.log("not able to get connection " + err);
			res.status(400).send(err);
		}
		
		// use in-built geoJSON functionality and create required geoJSON format
		// query adapted from http://www.postgresonline.com/journal/archives/267-Creating-GeoJSON-Feature-Collections-with-JSON-and-PostGIS-functions.html , accessed 4th January 2018
		 var querystring = " SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM ";
             querystring = querystring + "(SELECT 'Feature' As type,ST_AsGeoJSON(lg.geom)::json As geometry, ";
             querystring = querystring + "row_to_json((SELECT l FROM (SELECT name,surname, port_id) As l ";
             querystring = querystring + "    )) As properties";
             querystring = querystring + "   FROM formdata  As lg where lg.port_id = '"+req.params.port_id + "' limit 100  ) As f ";
		console.log(querystring);
		// client sends query
		client.query(querystring, function(err, result){
			done(); // release client back to the pool
			// raise error if there is one
			if (err){
				console.log(err);
				res.status(400).send(err);
			}
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




// serve static files - e.g. html, css
// should be the last line in the server
app.use(express.static(__dirname));