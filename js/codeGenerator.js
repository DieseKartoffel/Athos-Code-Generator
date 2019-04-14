var isMobile = /Mobi/.test(navigator.userAgent);
		if (isMobile) {
			document.getElementById("container").style.margin = "0";
		}
	
        // ----- Initialize Map Variable -----
        var map = L.map('map', {
            center: [55.949512, -3.191915], //initial position (Edinburgh)
            zoom: 9, //initial zoom level
			doubleClickZoom: false
        });
		//attempt to approximate user position based on ip address and relocate map center as soon as result comes back from API. Code keeps running async
		setMapToUserPos();
		
		
		//map.doubleClickZoom.disable(); 
		var geocodeService = L.esri.Geocoding.geocodeService();
       
        // ----- fetching map tiles from OSM in this case. "Design" of the map can be changed here. Requires attribution. -----

        //Standard OSM Map Style:
        /*
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        */

        //OpenMapSurfer.Roads Style:
        L.tileLayer('https://maps.heigit.org/openmapsurfer/tiles/roads/webmercator/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: 'Routing with <a href="http://www.liedman.net/leaflet-routsing-machine/">LRM</a> and <a href="http://project-osrm.org/">OSRM</a> | Imagery from <a href="http://giscience.uni-hd.de/">GIScience Research Group</a> | Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
		
        //Set Click listener for Map
        map.on('click', onMapClick);
		
		//saving when currently searching for routes. ignore marker clicks based on this
		var calculating = false;
		
		
		//markerCount never decreases and is used for naming additional to markers.length so there is no weirdness when deleting markers
		var markerCount = 0;
		var markers = []; //Main marker holding array
		var routes = []; //holds array of routes for each marker
		
		let warned = false; //used to save if the user has had a alert after placing too many markers so it only shows once
		let MARKERLIMIT = 20;
		
		//Create the initial Athos Code template based on the empty matrix
		createAthosCode()
		
        function onMapClick(e) {
		
			if(markers.length>MARKERLIMIT){
				alert("You have had your fun, but it ends here :(");
				return;
			}
			
			if(!warned && markers.length == Math.ceil(MARKERLIMIT/2)){
				alert("Too many nodes can cause your Browser to lag.")
				warned = true;
				return;
			}
			
			//Use mouse style to indicate no more markers can be placed until this process is finished
			document.getElementById("map").style.cursor = "progress";
			
			//turn off listener until success is verified
			map.off('click', onMapClick);
									
			document.getElementById("saveMatrix").disabled = true; //disable download button
			document.getElementById("createAthos").disabled = true; //disable code generation button
			
			//Create new marker with its own onClickListener that will remove it again
			let marker = L.marker([e.latlng.lat, e.latlng.lng],
			{      
				  draggable: false
			}).addTo(map);
			markerCount++;
			//Remove marker and its routes on click
			marker.on('click', function(event){
				if(calculating){
					return; //do nothing while on route searching to prevent bugs
				}
			
				let marker = event.target;
				console.log("You clicked on a marker to remove it");

				let indexOfMarker = markers.indexOf(marker);
				let markerRoutes = routes[indexOfMarker]; 
				
				//delete all routes containing this markers latLng as a waypoint
				for(let i = 0; i<routes.length;i++){
					let markerRoutes = routes[i];
					for(let j = 0; j < markerRoutes.length; j++){
						let router = markerRoutes[j];
						console.log(JSON.stringify(router.getWaypoints()));
						for(let k = 0; k < router.getWaypoints().length; k++){
							console.log(k);
							if(router.getWaypoints()[k].latLng != null && router.getWaypoints()[k].latLng.lng == marker.getLatLng().lng && router.getWaypoints()[k].latLng.lat == marker.getLatLng().lat){
								router.setWaypoints([]); //remove route that is connected to that marker
							}
						}
					}
				}
				map.removeLayer(marker);
				removeFromMatrix(marker);
			});
			
			//Add a popup so on mouseover users can see what node it is representing
			marker.bindPopup("Node "+ markerCount);
			marker.on('mouseover', function (e) {
				this.openPopup();
			});
			marker.on('mouseout', function (e) {
				this.closePopup();
			});
			
			//check for errors after timout. Depends on number of nodes. No new nodes can be created in that period. 
			calculating = true;
			let timeout = 2000 + (1 + markers.length) * 250; //some stupid way to set the timeout seconds
			setTimeout(function() { 
					nodeAddingSuccessCheck(marker); //after timeout check if every route was found successfully without relying on any error responses
				}, (timeout));
			
			//save progress: will be revoked if success check fails
			
			//save in array for later
			markers.push(marker);
			
			//Show new marker on clicked position	
			map.addLayer(marker);	
			
			//Add marker to matrix
			addToMatrix(marker);			
        }
		
		
		
		//add marker information to the html table matrix
		function addToMatrix(newMarker) {
		
			var name = "n" + (markerCount);
			var position = markers.length;
			
			//Find name of Location with Reverse Geocoding			
			geocodeService.reverse().latlng(newMarker.getLatLng()).run(function(error, result) {
				if(error){
					name = name + "_unkown";
					replaceValue(position, 0, name);
					replaceValue(0, position, name);
				}
				console.log(JSON.stringify(result));
				var subregion = result.address.Subregion;
				var countryCode = result.address.CountryCode;
				if(result.address.Subregion == ""){
					if(!result.address.City == ""){
						subregion = result.address.City; //sometimes subregion is null even though city is defined. then just use city
					}else{
						subregion = "unknown";
					}
				}
				if(result.address.CountryCode == ""){
					countrycode = "bat_country";
				}
				name = name + "_" + subregion + "_" + countryCode;
				name = name.replace(/\s/g, '_'); //Remove Spaces
				replaceValue(position, 0, name);
				replaceValue(0, position, name);
			});
			
			//Content of Header Row at index 0 (LatLng with 4 decimal places)
			let newColumn = [ name + ("_("+newMarker.getLatLng().lat.toFixed(4) + "|" + newMarker.getLatLng().lng.toFixed(4)+")") ];
			
			//save where distance will be placed in matrix later and initialise distance calculation
			for(let i = 0; i < markers.length; i++){
				let matrixX = markers.length;
				let matrixY = i+1;
				newColumn.push(nodeDistance(newMarker, markers[i], matrixX, matrixY)) //as soon as calculation is done, distance will be placed at x,y
			}
			
			//Content of Header Row at index 0 (LatLng with 4 decimal places)
			let newRow = [ "Node " + ("("+newMarker.getLatLng().lat.toFixed(4) + " | " + newMarker.getLatLng().lng.toFixed(4)+")") ];
			
			for(let i = 0; i < markers.length; i++){
				let matrixX = i+1;
				let matrixY = markers.length;
				newRow.push(nodeDistance(newMarker, markers[i], matrixX, matrixY))
			}
			
			appendColumn(newColumn);
			appendRow(newRow);		
		}
		
		function nodeAddingSuccessCheck(marker){
			
			var myTable = document.getElementById('table');
			
			let allGood = true;
			//check last row and column for missing values. Remove them, if its the case.
			for(let i = 0; i < markers.length; i++){
				if(myTable.rows[i].cells[markers.length].innerHTML.includes('Cal') || myTable.rows[markers.length].cells[i].innerHTML.includes('Cal')){
					//remove any of last drawn routes
					for(let j = 0; j<wa_routers.length;j++){
						wa_routers[j].setWaypoints([]);
					//	map.removeLayer(wa_routers[i])
					}
					//remove marker
					map.removeLayer(marker);
					removeFromMatrix(marker);
					//alert("Something went wrong with this one, please try again in a few seconds!\n(Either the route is impossible or the server did not respond in time.)");
					
					$('#map').before('<div class="alert alert-danger" id="oops"><strong>Oops...</strong> Something went wrong with this one, please try again in a few seconds!</div>');
					$('#oops').delay(4000).fadeOut(function() {
					   $(this).remove(); 
					});
					allGood = false;
					markerCount--; //dont allow marker number to increase on failure
					break;
				}
			}
			
			//no errors, save routes. routes are saved so they can be removed onMarkerClick
			markerRoutes = [];
			if(allGood){
				for(let i = 0; i<wa_routers.length;i++){
					markerRoutes.push(wa_routers[i]);
				}
				routes.push([]);
				routes[markers.length-1] = markerRoutes;
			}
			
			//Enable Cursor style again
			document.getElementById("map").style.cursor = "pointer";
			
			//Enable Map again
			map.on('click', onMapClick);
			document.getElementById("saveMatrix").disabled = false;
			document.getElementById("createAthos").disabled = false;
			//clear routers
			wa_routers = [];
			
			calculating = false;
		}
		
		
		
		function removeFromMatrix(oldMarker){
				let index = markers.indexOf(oldMarker);
				markers.splice(index, 1);
				deleteColumn(index);
				deleteRow(index);
		}
		
		//this method will return "Calculating". As soon as the route's distance is calculated, it will update the field at (x,y) with the distance.
		//this method returns "Calculating" [i]instantly[/i] without waiting for the calculation to take place, instead the route distance is handeled in a callback method.
		var rainbow = ['#FF0000', '#FF7F00','#FFFF00','#00FF00','#0000FF','#8B00FF']; //color codes for each new line
		var wa_routers = [] //hold all current routes to be able to remove them on error. cleared on every new node success.
		function nodeDistance(marker1, marker2, matrixX, matrixY){
			if(marker1 === marker2){
				return 0;
			}
			
			//find selected routing engine
			let osmr = document.getElementById("osmr").checked;
			let mbox = document.getElementById("mbox").checked;
			let ghopper = document.getElementById("ghopper").checked;
			
			//Show route between nodes on map
			let router = null;
			
			/*
			if(ghopper){
				//API Key registred on napier mail - Daily credits limit 15000: 74ed1037-39d7-4184-9856-b731b0639357
				console.log("Using Ghopper");
				router = L.Routing.control({
					waypoints: [
						L.latLng(marker1.getLatLng().lat, marker1.getLatLng().lng),
						L.latLng(marker2.getLatLng().lat, marker2.getLatLng().lng)
						],
					routeWhileDragging: false,
					draggableWaypoints: false,
					lineOptions: {styles: [{color: 'black', opacity: 0.15, weight: 9}, {color: 'white', opacity: 0.4, weight: 6}, {color: rainbow[(markers.length-2) % rainbow.length], opacity: 1, weight: 2}]},
					addWaypoints: false,
					createMarker: function() { return null; }, //marker is already created earlier.	
					router: L.Routing.graphHopper('74ed1037-39d7-4184-9856-b731b0639357')
				}).addTo(map);
			}
			*/
			
			if(ghopper){
				alert("Graphhopper not supported yet");
				osmr = document.getElementById("osmr").checked = true;
			}
			if (mbox){
				alert("Mapbox not supported yet");
				osmr = document.getElementById("osmr").checked = true;
			}
			if(osmr){
				console.log("Using OSMR");
				router = L.Routing.control({
				waypoints: [
					L.latLng(marker1.getLatLng().lat, marker1.getLatLng().lng),
					L.latLng(marker2.getLatLng().lat, marker2.getLatLng().lng)
					],
					routeWhileDragging: false,
					draggableWaypoints: false,
					lineOptions: {styles: [{color: 'black', opacity: 0.15, weight: 9}, {color: 'white', opacity: 0.4, weight: 6}, {color: rainbow[(markers.length-2) % rainbow.length], opacity: 1, weight: 2}]},
					addWaypoints: false,
					createMarker: function() { return null; } //marker is already created earlier.	
				}).addTo(map);
			}
			
			wa_routers.push(router);
			
			router.hide(); //only works fully in combination with css rule
			
			//Callback when route is found
			router.on('routesfound', function(e) {
				var routes = e.routes;
				replaceValue(matrixX, matrixY, routes[0].summary.totalDistance.toFixed(1) + "m\t\t("+(routes[0].summary.totalTime/60).toFixed(1)+"min)"); //replacing "Calculating" with actual distance
			});

			return "Calculating...";
		}
		
		//place map center at est. user IP location. Async
        function setMapToUserPos() {
            $.ajax('http://ip-api.com/json')
                .then(
                    function success(response) {
                        var pos = [response.lat, response.lon];
                        console.log('Retrieved IP Locatoin ', pos[0] + " " + pos[1]);
                        map.setView(pos, 8);
                    },
                    function fail(data, status) {
                        console.log('IP Location failed. Do nothing', status);
                        //
                    }
                );
        }

        //Thread.sleep(ms)
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
		
		
		
		//						----------- HTML Table Handling ------------
		
		
		function replaceValue(x,y,value){
				var myTable = document.getElementById('table');
				myTable.rows[y].cells[x].innerHTML = value;
		}
		
		
		
		// append row to the HTML table
		function appendRow(contents) {
			var tbl = document.getElementById('table'), // table reference
				row = tbl.insertRow(tbl.rows.length),      // append table row
				i;
			// insert table cells to the new row
			for (i = 0; i < tbl.rows[0].cells.length; i++) {
				createCell(row.insertCell(i), contents[i], 'row');
			}
		}
		
		// append column to the HTML table
		function appendColumn(contents) {
			var tbl = document.getElementById('table'), // table reference
			i;
			// open loop for each row and append cell
			for (i = 0; i < tbl.rows.length; i++) {
				createCell(tbl.rows[i].insertCell(tbl.rows[i].cells.length), contents[i], 'col');
			}
		}
		
		 
		// create DIV element and append to the table cell
		function createCell(cell, text, style) {
			var div = document.createElement('div'), // create DIV element
				txt = document.createTextNode(text); // create text node
			div.appendChild(txt);                    // append text node to the DIV
			//div.setAttribute('class', style);        // set DIV class attribute
			//div.setAttribute('className', style);    // set DIV class attribute for IE (?!)
			cell.appendChild(div);                   // append DIV to the table cell
		}
		
		function deleteRow(index) {
			var tbl = document.getElementById('table'), // table reference
				lastRow = tbl.rows.length - 1,             // set the last row index
				i;

			tbl.deleteRow(index+1);
			
		}
		 
		function deleteColumn(index) {
			var tbl = document.getElementById('table');

			// delete cells with index greater then 0 (for each row)
			for (let i = 0; i < table.rows.length; i++) {
				tbl.rows[i].deleteCell(index+1);
			}
		}
		
		// ------------- Button Handling and Code Creation ---------------
		
		
		function saveMatrix(){
			console.log("Download");
			var table = document.getElementById("table");
			var oldTable = [];
			
			//create new format for csv file. (plain values, seperated by ',')
			for (var i = 1, row; row = table.rows[i]; i++) {
			   for (var j = 1, col; col = row.cells[j]; j++) {
			     oldTable.push(table.rows[i].cells[j].innerHTML); //backing up old format ('m and min')
				 table.rows[i].cells[j].innerHTML = table.rows[i].cells[j].innerHTML.replace("m\t\t(",",").replace("min)","");
			   }  
			}
			
			var csv = $("table").table2CSV(); //Original at https://github.com/rubo77/table2CSV, However Code was edited by me to only contain necessary .csv creation!
			
			//replace table with formated values
			let k = 0;
			for (var i = 1, row; row = table.rows[i]; i++) {
			   for (var j = 1, col; col = row.cells[j]; j++) {
				 table.rows[i].cells[j].innerHTML = oldTable[k];
				 k++;
			   }  
			}
			
			//Create Element with data in URL, click it, then remove it.
	
			var a = document.createElement('a');
			a.setAttribute('href', 'data:text/csv;charset=UTF-8,' + encodeURIComponent(csv));
			a.setAttribute('download', "mynodes.csv");
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			
		}
		
		
		
		/*
				--- Example Code ---
		
		nodes

			node n0 (1.0, 1.0) 
			node n1 (1.0, 8.0) 
			node n2 (2.0, 11.0)  
			...

		edges

			edge undirected e0 from n0 to n1 length 1.0
			edge undirected e1 from n1 to n2 length 7.5
			edge undirected e2 from n2 to n4 length 12.0
			...
		
		*/
		
		
		function createAthosCode(){
			var scale = 100;
			var markers_copy = [];
			//"clone" markers, if originals are altered, adding new ones will cause error in routing machine
			for(let i = 0; i < markers.length; i++){
				var original = markers[i];
				var copy = {lat:original.getLatLng().lat, lng:original.getLatLng().lng};
				markers_copy.push(copy);
			}
		
			console.log("Create Code");
			var result = document.getElementById("codeResult"); //using a pre tag for "codeResult" allows usage of \n and \t
			
			var code = [];
						
			code.push("// \t\t\t\t\t --- ATHOS CODE GENERATOR OUTPUT --- \n//\tThe following code block was created using an online tool on www.athos.napier.ac.uk");
			code.push("");
			
			code.push("model generatedModel");
			code.push("");
			
			
			code.push("//Definition of world size");
			code.push("world xmin 0 xmax " + (scale) + " ymin 0 ymax " + (scale));

			
			code.push("");
			code.push("agentTypes");
			code.push("  //Define your agent types and behaviours here");
			code.push("  //agentType myAgent congestionFactor 1.0 maxWeight 180.0");
			code.push("  //  behaviour load myProduct absQuantity 42.0;");
			code.push("  //  ...");
			
			code.push("");
			code.push("functions");
			code.push("  //Define other duration functions here");
			code.push("  //Example: length in kilometers + cfactor as time in min");
			code.push("  durationFunction normal (length/1000) + cfactor + (0*accCongestionFactor) default")
			code.push("  //...");

			//subtract smallest lat/lng from other node and translate values on to integers between 1 and 1000
			
			console.log("Translating Values to suitable Graph Coordinates:")
			
			code.push("");
			code.push("network");
			
			code.push("");
			code.push("nodes");
			code.push("  //List your nodes here");
			
			var matrix = document.getElementById('table');
			var useTimes = document.getElementById("useTimes").checked;
			
			//find smallest/largest lat and lng
		
			var smallest_lat = 9999999;	
			var smallest_lng = 9999999;
			
			var largest_lat = -9999999;
			var largest_lng = -9999999;
			
			for(let i = 0; i < markers_copy.length; i++){
				let marker = markers_copy[i];
				if(marker.lat < smallest_lat){
					smallest_lat = marker.lat;
				}
				if(marker.lng < smallest_lng){
					smallest_lng = marker.lng;
				}
				if(marker.lat > largest_lat){
					largest_lat = marker.lat;
				}
				if(marker.lng > largest_lng){
					largest_lng = marker.lng;
				}
			}
			
			if(largest_lat == -9999999 && smallest_lat == 9999999){
				//no nodes created, create small empty map
				largest_lat = 0;
				largest_lng = 0;
				smallest_lat = 0;
				smallest_lng = 0;
			}
			
			var largest = 1;
			if(largest_lat - smallest_lat > largest_lng - smallest_lng){
				largest = largest_lat - smallest_lat;
			}else{
				largest = largest_lng - smallest_lng;
			}
			
			console.log("Smallest Lat = \t" + (smallest_lat - smallest_lat));
			console.log("Smallest Lng = \t" + (smallest_lng - smallest_lng));
			console.log("Largest Lat = \t" + (largest_lat - smallest_lat));
			console.log("Largest Lng = \t" + (largest_lng - smallest_lng));
			
			console.log("LARGEST IS "+largest);
			
			var rel = 1;
			if(largest != 0){
				rel = scale/largest;
			}
			
			console.log("SCALE IS "+rel);
			
			
			for(let i = 0; i < markers_copy.length; i++){
				let marker = markers_copy[i];
				console.log("From Lng/Lat \t" + (marker.lng-smallest_lng) + " " + (marker.lat-smallest_lat))
				marker.lat = (rel * (marker.lat - smallest_lat));
				marker.lng = (rel * (marker.lng - smallest_lng));
				console.log("  To X/Y \t" + marker.lng + " " + marker.lat);
				//node n0 (1.0, 1.0)
				var name = matrix.rows[0].cells[i+1].innerHTML.replace(/[^a-zA-Z0-9]/g,'_');
				code.push("  node "+name+"("+marker.lng.toFixed(1)+", "+marker.lat.toFixed(1)+")");
			}
			
			code.push("");
			code.push("edges");
			code.push("  //List your edges here");
			
			let e = 0;
			for(let i = 1; i < markers_copy.length; i++){
				for(let j = i; j < markers_copy.length; j++) {
					var meters = matrix.rows[i].cells[j+1].innerHTML.split("\t\t")[0].replace("m","");
					var time = "1.0";
					if(useTimes){ //checkbox
						time = matrix.rows[i].cells[j+1].innerHTML.split("\t\t")[1].replace("(","").replace(")","").replace("min","");
					}
					//edge undirected e0 from n0 to n1 length 1.0
					//replace all special characters here
					code.push("  edge undirected e" + e + " from " + matrix.rows[0].cells[i].innerHTML.replace(/[^a-zA-Z0-9]/g,'_') + " to " + matrix.rows[0].cells[j+1].innerHTML.replace(/[^a-zA-Z0-9]/g,'_') + " length " + meters + " cfactor " + time + " function normal");
					e++;
				}
			}
			
			code.push("");
			code.push("sources");
			code.push("  //Define your sources here")
			code.push("  //n0 isDepot myProduct sprouts ( myAgent ) frequency 1.0 every 1 until 1 ")
			
			code.push("");
			code.push("demands");
			code.push("  //Define your demands here")
			code.push("  //n1 hasDemand myProduct absQuantity 42.0 ")
			
			code.push("");
			code.push("defineMetrics updateRate 10")
			code.push("");
			code.push("//Add additional code")
			code.push("//...")
			
			result.innerHTML = code.join("\n\t") 
		}
		
		function openInEditor(){
			var rawCode = document.getElementById("codeResult").innerHTML;
			var b64Code = b64EncodeUnicode(rawCode);
			window.open("https://athos.napier.ac.uk/editor/?c="+b64Code);	
		}
		
		function b64EncodeUnicode(str) {
		// first we use encodeURIComponent to get percent-encoded UTF-8,
		// then we convert the percent encodings into raw bytes which
		// can be fed into btoa.
		return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
			function toSolidBytes(match, p1) {
				return String.fromCharCode('0x' + p1);
		}));
		
}
		
		