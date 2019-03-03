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

// do POST request reflect uploaded data to studentServer.js
app.post('/reflectData', function(req, res){
	// Using POST hence uploading data
	// parameters form part of BODY request c.f. RESTful API
	console.dir(req.body);
	
	// Echo request back to client
	res.send(req.body);
});

// add POST command that connects to the database and inserts a record into the formData table

app.post('/uploadData', function (req, res) {
    // note that we are using POST here as we are uploading data
    // so the parameters form part of the BODY of the request rather than the RESTful API
    console.dir(req.body);
    pool.connect(function (err, client, done) {
        if (err) {
            console.log("not able to get connection " + err);
            res.status(400).send(err);
        }
        var name = req.body.name;
        var surname = req.body.surname;
        var module = req.body.module;
        var portnum = req.body.port_id;
        var language = req.body.language;
        var modulelist = req.body.modulelist;
        var lecturetime = req.body.lecturetime;
        var geometrystring = "st_geomfromtext('POINT(" + req.body.longitude + " " + req.body.latitude + ")')";

        var querystring = "INSERT into formdata (name,surname,module, port_id,language, modulelist, lecturetime, geom) values ($1,$2,$3,$4,$5,$6,$7,";
        var querystring = querystring + geometrystring + ") ";
        console.log(querystring);
        client.query(querystring, [name, surname, module, portnum, language, modulelist, lecturetime], function (err, result) {
            done();
            if (err) {
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send("row inserted");

        });
    });
});


// get formData as geojson
app.get('/getFormData/:port_id', function (req, res) {
    pool.connect(function (err, client, done) {
        if (err) {
            console.log("not able to get connection " + err);
            res.status(400).send(err);
        }
        // use the inbuilt geoJSON functionality
        // and create the required geoJSON format using a query adapted from here: http://www.postgresonline.com/journal/archives/267-Creating-GeoJSON-Feature-Collections-with-JSON-and-PostGIS-functions.html, accessed 4th January 2018
        // note that query needs to be a single string with no line breaks so built it up bit by bit
        var querystring = " SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM ";
        querystring = querystring + "(SELECT 'Feature' As type,ST_AsGeoJSON(lg.geom)::json As geometry, ";
        querystring = querystring + "row_to_json((SELECT l FROM (SELECT name,surname, port_id) As l ";
        querystring = querystring + "    )) As properties";
        querystring = querystring + "   FROM formdata  As lg where lg.port_id = '" + req.params.port_id + "' limit 100  ) As f ";
        console.log(querystring);
        client.query(querystring, function (err, result) {
            //call `done()` to release the client back to the pool
            done();
            if (err) {
                console.log(err);
                res.status(400).send(err);
            }
            res.status(200).send(result.rows);
        });
    });
});
	
// make geojson server more flexible to generate geojson from any spatial table
app.get('/getGeoJSON/:tablename/:geomcolumn/:portNumber?', function(req,res){
	pool.connect(function(err,client,done){
		// if unable to connect
		if (err){
			console.log("not able to get connection " + err);
			res.status(400).send(err);
		}
		
		var colnames = "";
		// get list of columns in the table
		// use string_agg to generate csv list that can then be pasted into next query
		 var tablename = req.params.tablename;
        var geomcolumn = req.params.geomcolumn;
        var querystring = "select string_agg(colname,',') from ( select column_name as colname ";
        querystring = querystring + " FROM information_schema.columns as colname ";
        querystring = querystring + " where table_name   =$1";
        querystring = querystring + " and column_name <> $2 and data_type <> 'USER-DEFINED') as cols ";
		console.log("Query string 1: " + querystring);
		
		// run the query
		client.query(querystring,[tablename, geomcolumn], function(err,result){
			done(); // call done() to release client back to the pool
			// raise error
			if (err){
				console.log(err);
				res.status(400).send(err);
			}
			thecolnames = result.rows[0].string_agg;
			colnames = thecolnames;
			console.log("the colnames " + thecolnames); // log colnames in console
			
			// use the inbuilt geoJSON functionality
			// and create the required geoJSON format using a query adapted from here: http://www.postgresonline.com/journal/archives/267-Creating-GeoJSON-Feature-Collections-with-JSON-and-PostGIS-functions.html, accessed 4th January 2018
			// note that query needs to be a single string with no line breaks so built it up bit by bit
			var querystring = " SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features  FROM ";
            querystring = querystring + "(SELECT 'Feature' As type     , ST_AsGeoJSON(lg." + req.params.geomcolumn + ")::json As geometry, ";
            querystring = querystring + "row_to_json((SELECT l FROM (SELECT " + colnames + ") As l      )) As properties";

			// depending on whether we have a port number, do different things
			// if we have a portNumber
			if (req.params.portNumber) {
                querystring = querystring + "   FROM " + req.params.tablename + "As lg where lg.port_id = '" + req.params.portNumber + "' limit 100  ) As f ";
            }
			else {
                querystring = querystring + "    FROM " + req.params.tablename + " As lg limit 100 ) As f ";
            }

			console.log("Query string 2: " + querystring);
			
			// run the 2nd query
			client.query(querystring, function(err, result){
				done(); // release client back to the pool
				if (err){
					console.log(err);
					res.status(400).send(err);
				}
				res.status(200).send(result.rows);
			});
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