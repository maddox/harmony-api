var fs = require('fs')
var path = require('path')
var util = require('util')
var mqtt = require('mqtt');
var express = require('express')
var morgan = require('morgan')
var bodyParser = require('body-parser')
var parameterize = require('parameterize');

var config = require('./config/config.json');

var harmonyHubDiscover = require('harmonyhubjs-discover')
var harmony = require('harmonyhubjs-client')

var harmonyHubClient
var harmonyActivitiesCache = {}
var harmonyActivityUpdateInterval = 1*60*1000 // 1 minute
var harmonyActivityUpdateTimer

var harmonyState
var harmonyStateUpdateInterval = 5*1000 // 5 seconds
var harmonyStateUpdateTimer

var mqttClient = mqtt.connect(config.mqtt_host);
var TOPIC_NAMESPACE = "harmony-api"

var app = express()
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')));

var logFormat = "'[:date[iso]] - :remote-addr - :method :url :status :response-time ms - :res[content-length]b'"
app.use(morgan(logFormat))

// Middleware
// Check to make sure we have a harmonyHubClient to connect to
var hasHarmonyHubClient = function(req, res, next) {
  if (hasHarmonyHubClient) {
    next()
  }else{
    res.status(500).json({message: "Can not connect to hub."})
  }
}
app.use(hasHarmonyHubClient)


var discover = new harmonyHubDiscover(61991)

discover.on('online', function(hubInfo) {
  // Triggered when a new hub was found
  console.log('Hub discovered ' + hubInfo.ip + '.')

  if (hubInfo.ip) {
    console.log('Stopping discovery.')
    discover.stop()

    harmony(hubInfo.ip).then(startProcessing)
  }

})

if (config['hub_ip']) {
  // Connect to hub:
  console.log('Connecting to Harmony hub at ' + config['hub_ip'])
  harmony(config['hub_ip']).then(startProcessing)
}else{
  // Look for hubs:
  console.log('Starting discovery.')
  discover.start()
}

// mqtt api

mqttClient.on('connect', function () {
  mqttClient.subscribe('harmony/command/+')
});

mqttClient.on('message', function (topic, message) {
  var commandPattern = new RegExp(/command\/(.*)/);
  var commandMatches = topic.match(commandPattern);

  if (commandMatches) {
    var action = commandMatches[1]
    var state = message.toString()

    if (action === 'start_activity') {
      activity = activityByName(state)

      if (activity) {
        startActivity(activity.id)
      }
    } else if (action === 'off') {
      off()
    }

  }

});


function startProcessing(harmonyClient){
  harmonyHubClient = harmonyClient

  // update the list of activities
  updateActivities()
  // then do it on the set interval
  clearInterval(harmonyActivityUpdateTimer)
  harmonyActivityUpdateTimer = setInterval(function(){ updateActivities() }, harmonyActivityUpdateInterval)

  // update the list of activities on the set interval
  clearInterval(harmonyStateUpdateTimer)
  harmonyStateUpdateTimer = setInterval(function(){ updateState() }, harmonyStateUpdateInterval)
}

function updateActivities(){
  if (!harmonyHubClient) { return }
  console.log('Updating activities.')

  harmonyHubClient.getActivities().then(function(activities){
    foundActivities = {}
    activities.some(function(activity) {
      foundActivities[activity.id] = {id: activity.id, label: activity.label, isAVActivity: activity.isAVActivity}
    })

    harmonyActivitiesCache = foundActivities
  })
}

function updateState(){
  if (!harmonyHubClient) { return }
  console.log('Updating state.')

  var previousActivityName = currentActivityName()

  harmonyHubClient.getCurrentActivity().then(function(activityId){
    data = {off: true}

    activity = harmonyActivitiesCache[activityId]

    if (activityId != -1 && activity) {
      data = {off: false, current_activity: activity}
    }else{
      data = {off: true}
    }

    harmonyState = data

    // publish state if it has changed
    activityName = currentActivityName()

    if (activityName != previousActivityName) {
      state = parameterize(activityName).replace(/-/g, '_')
      publish('state', state, {retain: true});
    }

  })
}

function cachedHarmonyActivities(){
  return Object.keys(harmonyActivitiesCache).map(function(key) {
    return harmonyActivitiesCache[key]
  })
}

function currentActivityName(){
  if (!harmonyHubClient || !harmonyState) { return null}

  return harmonyState.off ? 'off' : harmonyState.current_activity.label
}

function activityByName(activityName){
  var activity
  cachedHarmonyActivities().some(function(a) {
    if(a.label === activityName) {
      activity = a
      return true
    }
  })

  return activity
}

function off(){
  if (!harmonyHubClient) { return }

  harmonyHubClient.turnOff().then(function(){
    updateState()
  })
}

function startActivity(activityId){
  if (!harmonyHubClient) { return }

  harmonyHubClient.startActivity(activityId).then(function(){
    updateState()
  })
}

function publish(topic, message, options){
  topic = TOPIC_NAMESPACE + "/" + topic
  mqttClient.publish(topic, message, options);
}

app.get('/_ping', function(req, res){
  res.send('OK');
})

app.get('/', function(req, res){
  res.sendfile('index.html');
})

app.get('/activities', function(req, res){
  res.json({activities: cachedHarmonyActivities()})
})

app.get('/status', function(req, res){
  res.json(harmonyState)
})

app.put('/off', function(req, res){
  off()

  res.json({message: "ok"})
})

app.post('/start_activity', function(req, res){
  activity = activityByName(req.body.activity_name)

  if (activity) {
    startActivity(activity.id)

    res.json({message: "ok"})
  }else{
    res.status(404).json({message: "Not Found"})
  }
})

app.listen(process.env.PORT || 8282)
