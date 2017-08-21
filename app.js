var _clients = [];
var _dico_target_var_view = {};
var _is_server_init = false;

function connect_to_DB(filepath) {
	var db_connection = new sqlite3.Database(filepath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function (error) {
		if (error == null) {
			console.info("Connection successfully to DB file " + filepath);
		}
		else {
			console.error("Error when connect to DB file + " + filepath + ". Error msg: "+ error);
		}
	});

	return db_connection;
}

function notify_client_server_ready(socket) {
	if (_is_server_init) {
		socket.emit('server_ready', Object.keys(_dico_target_var_view));
	}
}

function notify_clients_server_ready() {
	_clients.forEach(function(sk) {
		notify_client_server_ready(sk);
	});
}

function set_server_initialized() {
	_is_server_init = true;
	notify_clients_server_ready();
}

function retrieve_column_names_and_build_views(db_connection) {
	db_connection.serialize(function() {
		// We need to retreive the list of column names
		var get_col_names_query = "PRAGMA table_info(census_learn_sql)";
		var column_names = [];
		db_connection.all(get_col_names_query, function(err, rows) {
			if (err == null) {
				rows.forEach(function (column_header) { 
					column_names.push(column_header.name);
				});
			}
			else {
				console.error("Unable to retrieve column names. Error: " + err);
			}

			column_names.forEach(function(target_variable) {
				db_connection.serialize(function() {
					/*
					* Preparing a statement with placeholders $param or '?' ... DOES... NOT... WORK...
					* Unfortunate workaround by building the query
					*/
					var view_sql_templte = "CREATE VIEW IF NOT EXISTS `" + target_variable + "_view" + "` AS SELECT `" + target_variable + "` AS val, COUNT(`" 
						+ target_variable + "`) AS num, AVG(age) AS avg_age FROM census_learn_sql GROUP BY `" + target_variable + "`" + " ORDER BY COUNT(`" + target_variable + "`)";
					db_connection.run(view_sql_templte, function(err, row) {
						if (err == null) {
							_dico_target_var_view["" + target_variable] = target_variable + "_view";
							/**
							* When the last view creation is done, server is good :)
							*/
							if (Object.keys(_dico_target_var_view).length == column_names.length) {
								set_server_initialized();
							}
						}
						else {
							console.error("Cannot create the view for target " + err + " Error: " + err);
						}
					});
				});
			});
		});
	});
}

function get_values_for_column(db_connection, target_col, client_socket)
{
	db_connection.serialize(function() {
		var get_col_info_query = "SELECT * FROM `" + target_col + "_view`";
		db_connection.all(get_col_info_query, function(err, rows) {
			if (err == null) {
				console.info('Retrieved successfully data related to the feature');
				client_socket.emit('feature_data_result', { "success": true, "data":rows });
			}
			else {
				console.error('An error occurred while retrieving data related to the feature : ' + err);
				client_socket.emit('feature_data_result', { "success": false, "data":null });
			}
		})
	});
}

var fs = require('fs');
if (process.argv.length != 3) {
	console.error('Usage: node app.js db_relative_filepath');
	process.exit(1);
} else {
	fs.exists(process.argv[2], function (exists) {
		if (!exists) { 
			console.error('DB file ' +  process.argv[2] + ' does not exist');
			process.exit(1);
		} 
	});
}

var http = require('http');
var express = require('express');
var app = express.createServer();
var io = require('socket.io').listen(app);
var sqlite3 = require('sqlite3').verbose();

app.get('*', function(req, res){
	res.sendfile('index.html', { root:__dirname + '/views/' });
});
var db = connect_to_DB(process.argv[2]);

io.sockets.on('connection', function(socket) { 
	/**
	* When a client connects we acknowledge the connection, keep track of a way to communicate 
	* with it and if the server is already ready, send data
	*/ 
	socket.emit('client_init_connection', { 'data':'you are registered to the server' });
	_clients.push(socket);
	notify_client_server_ready(socket);

	socket.on('select_feature', function(msg) {
		console.info('client ' + socket.id + 'requests data on feature ' + msg);
		// Check that element exists
		if (Object.keys(_dico_target_var_view).indexOf(msg) >= 0) {
			get_values_for_column(db, msg, socket);
		}
		else
		{
			console.error('the requested feature does not exist');
		}
	})
});


retrieve_column_names_and_build_views(db);

process.on('exit', function() {
	db.close();
});

app.listen(8080);