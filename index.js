var APP_ID = 'amzn1.ask.skill.ac3e0838-fa40-4685-a101-9e1605e28843';
var http = require('http');

var AlexaSkill = require('./AlexaSkill');

var FlightSearch = function() {
  AlexaSkill.call(this, APP_ID);
};

FlightSearch.prototype = Object.create(AlexaSkill.prototype);
FlightSearch.prototype.constructor = FlightSearch;

FlightSearch.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
};

FlightSearch.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    handleWelcomeRequest(response);
};

FlightSearch.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
};

FlightSearch.prototype.intentHandlers = {
    "OneshotFlightIntent": function (intent, session, response) {
        handleOneshotFlightRequest(intent, session, response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        handleHelpRequest(response);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

var STATIONS = {
  'new york' : 'JFK',
  'nyc' : 'JFK',
  'new york city' : 'JFK',
  'la guardia' : 'LGA',
  'los angeles' : 'LAX',
  'la' : 'LAX',
  'chicago' : 'ORD',
  'atlanta' : 'ATL',
  'san francisco' : 'SFO',
  'san fran' : 'SFO',
  'sf': 'SFO',
  'miami' : 'MIA',
  'dallas' : 'DFW',
  'houston' : 'HOU'
};

function handleWelcomeRequest(response) {
    var whichCityPrompt = "Which city would you like to fly to?",
        speechOutput = {
            speech: "<speak>Welcome to Expedia. "
                + whichCityPrompt
                + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        },
        repromptOutput = {
            speech: "I can get you the cheapest ticket to your destination. "
                + whichCityPrompt,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };

    response.ask(speechOutput, repromptOutput);
}

function handleHelpRequest(response) {
    var repromptText = "Which city would you like to travel to?";
    var speechOutput = "I can lead you through providing a city and your departure date. "
        + repromptText;

    response.ask(speechOutput, repromptText);
}


function handleOneshotFlightRequest(intent, session, response){

  var cityStation = getCityStationFromIntent(intent, true),
        repromptText,
        speechOutput;
    if (cityStation.error) {
        // invalid city. move to the dialog
        repromptText = "Please tell me another. For example, los angeles. ";
        // if we received a value for the incorrect city, repeat it to the user, otherwise we received an empty slot
        speechOutput = cityStation.city ? "I'm sorry, I don't have any data for " + cityStation.city + ". " + repromptText : repromptText;

        response.ask(speechOutput, repromptText);
        return;
    }

    // Determine custom date
    var date = intent.slots.Date.value;
    if (!date) {
        // Invalid date. set city in session and prompt for date
        session.attributes.city = cityStation;
        repromptText = "Please tell me another day or date.";
        speechOutput = "I'm sorry, I didn't understand that date. " + repromptText;

        response.ask(speechOutput, repromptText);
        return;
    }

  getFinalFlightResponse(date, cityStation, response);
}

function getFinalFlightResponse(date, cityStation, response) {
  getJsonFromExpedia(date, cityStation.station, function(data){
    var speechOutput;
    var cardTitle;
    var cardContent;
    var ticketPrice = data.offers[0].totalFarePrice.formattedPrice;
    var departureInfo = data.legs[0].segments[0].departureTime;
    var arrivalInfo = data.legs[0].segments[0].arrivalTime;
    var layOver = data.legs[0].segments[0].arrivalAirportAddress.city;
    var layOverCode = data.legs[0].segments[0].arrivalAirportCode;
    var remainingTickets = data.offers[0].seatsRemaining;
    if (data.offers[0] != undefined && data.legs[0].segments.length == 1) {
          // var plurality = data.offers[0].numberOfTickets
          speechOutput = 'The cheapest ticket I found to ' + data.searchCities[1].city + ' for ' + date + ' is a total of ' + ticketPrice + '. ' + 'This is a direct flight';
          cardTitle = 'SEA to ' + cityStation.station;
          cardContent = 'Price: ' + ticketPrice + ' .\n Seats Available: '+ remainingTickets + '.\n' + ' Departing ' + data.searchCities[0].city + ' on ' + departureInfo + " .\n  Arriving " + data.searchCities[1].city + " on " + arrivalInfo + ".";
    } else if (data.offers[0] && data.legs[0].segments.length == 2) {
          speechOutput = 'The cheapest ticket I found to ' + data.searchCities[1].city + ' for ' + date + ' is a total of ' + ticketPrice + '.' + ' This flight has a lay over in ' + layOver + ".";
          cardTitle = 'SEA to ' + layOverCode + " to " + cityStation.station;
          cardContent = 'Price: ' + ticketPrice + ' .\n Seats Available: '+ remainingTickets + '.\n' + ' Departing ' + data.searchCities[0].city + ' on ' + departureInfo + " .\n  Arriving " + data.searchCities[1].city + " on " + arrivalInfo + "."
    } else if (data.offers[0] && data.legs[0].segments.length == 3) {
          var arrival = data.legs[0].segments[2].arrivalTime;
          var secondLayOver = data.legs[0].segments[1].arrivalAirportAddress.city;
          var secondLayOverCode = data.legs[0].segments[1].arrivalAirportCode;
          speechOutput = 'The cheapest ticket I found to ' + data.searchCities[1].city + ' for ' + date + ' is a total of ' + ticketPrice + '.' + ' This flight has 2 lay overs in ' + layOver + " and " + secondLayOver + ".";
          cardTitle = 'SEA to ' + layOverCode + " to " + secondLayOverCode + " to " + cityStation.station;
          cardContent = 'Price: ' + ticketPrice + ' .\n Seats Available: '+ remainingTickets + '.\n' + ' Departing ' + data.searchCities[0].city + ' on ' + departureInfo + " .\n  Arriving " + data.searchCities[1].city + " on " + arrival + "."
    } else if (data.offers[0] === undefined) {
        speechOutput = "There are no flights available for the specified date. " + "Please try a different date";
    } else {
        speechOutput = 'There are no scheduled flights for the provided parameters at this time, please revise your parameters.'
    }

    // var heading = 'Flights from Seattle to L.A are';
    // This is the response that "tells" the user about the current status pertaining to the output.
    response.tellWithCard(speechOutput, cardTitle, cardContent);
  });
}


function getJsonFromExpedia(date, station, callback) {
  var EXPEDIA_KEY = 'VQjoqeEljk3pdp5tKVWRstwPlMRRwzIp';
  var endpoint = 'http://terminal2.expedia.com:80/x/mflights/search?departureDate='+date+'&departureAirport=SEA&arrivalAirport='+station+'&prettyPrint=true&numberOfAdultTravelers=1&maxOfferCount=1&apikey='+ EXPEDIA_KEY;

  http.get(endpoint, function(res){
    var body = '';

    res.on('data', function(data){
      body += data;
    });

    res.on('end', function(){
      var result = JSON.parse(body);
      callback(result);
    });
  }).on('error', function(e){
    console.log("Error: " + e);
  });
}


function getCityStationFromIntent(intent, assignDefault) {

    var citySlot = intent.slots.City;
    // slots can be missing, or slots can be provided but with empty value.
    // must test for both.
    if (!citySlot || !citySlot.value) {
        if (!assignDefault) {
            return {
                error: true
            }
        } else {
            // For sample skill, default to Seattle.
            return {
                city: 'chicago',
                station: STATIONS.chicago
            }
        }
    } else {
        // lookup the city. Sample skill uses well known mapping of a few known cities to station id.
        var cityName = citySlot.value;
        if (STATIONS[cityName.toLowerCase()]) {
            return {
                city: cityName,
                station: STATIONS[cityName.toLowerCase()]
            }
        } else {
            return {
                error: true,
                city: cityName
            }
        }
    }
}

exports.handler = function (event, context) {
  var flightSearch = new FlightSearch();
  flightSearch.execute(event, context);
}
