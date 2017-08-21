$(function() {
	$('div#normal_view').hide();
});

function switch_to_wait_layout() {
	$('div#init_splash').show();
	$('div#normal_view').hide();
}

function switch_to_data_layout() {
	$('div#init_splash').hide();
	$('div#normal_view').show();
}

// when we receive the data from the server we dynamically build the table
function build_results_to_table(data) {
	$('#table_header').append($('<th>Feature value</th>'));
	$('#table_header').append($('<th>Number of instances (asc. sort)</th>'));
	$('#table_header').append($('<th>Average age</th>'));

	// first element is always null
	data.shift();
	data.forEach(function(singleRow) {
		$('tbody').append($('<tr>' 
							+ '<td>' 
							+ singleRow["val"] 
							+ '</td>' 
							+ '<td>' 
							+ singleRow["num"] 
							+ '</td>' 
							+ '<td>' 
							+ Math.round(singleRow["avg_age"]) 
							+ '</td>' 
							+'</tr>'));

	});			
}

function remove_previous_table_content() {
	$('#table_header').empty();
	$('tbody').empty();
}

var target_features = null;
var socket = io.connect('http://localhost:8080/');
socket.on('connect', function() {
	console.log('Connect to server');
});

// initial ack from the server
socket.on('client_init_connection', function(data) {
	console.log('Connection established to server: ' + data.data);
});

// when the server has finished to create the views it sends the list of features so we can browse them
socket.on('server_ready', function(data) {
	console.log("Retrieved start data");
	target_features = data;
	target_features.sort();
	target_features.forEach(function(e) {
		$('select#features_selector').append($('<option value="' + e + '">' + e + '</option>'));
	});
	switch_to_data_layout();
});

// when receiving results we simply build the table
socket.on('feature_data_result', function(msg) {
	if (msg != null && msg.success) {
		// we must first remove the previous content
		remove_previous_table_content();
		build_results_to_table(msg.data);
	}
	switch_to_data_layout();
});

socket.on('disconnect', function(){
	console.log('Connection lost with server');
});

function changeEventHandler(event) {
	socket.emit('select_feature', event.target.value);
	switch_to_wait_layout();
}