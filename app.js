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

discover.on('offline', function(hub) {
  // Triggered when a hub disappeared
  console.log('lost hub at: ' + hub.ip)
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
  mqttClient.subscribe(TOPIC_NAMESPACE + '/activities/+/command')
});

mqttClient.on('message', function (topic, message) {
  var commandPattern = new RegExp(/activities\/(.*)\/command/);
  var commandMatches = topic.match(commandPattern);

  if (commandMatches) {
    var activitySlug = commandMatches[1]
    var state = message.toString()

    activity = activityBySlug(activitySlug)
    if (!activity) { return }

    if (state === 'on') {
      startActivity(activity.id)
    }else if (state === 'off'){
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
      foundActivities[activity.id] = {id: activity.id, slug: parameterize(activity.label), label:activity.label, isAVActivity: activity.isAVActivity}
    })

    harmonyActivitiesCache = foundActivities
  })
}

function updateState(){
  if (!harmonyHubClient) { return }
  console.log('Updating state.')

  // save for comparing later after we get the true current state
  var previousActivity = currentActivity()

  harmonyHubClient.getCurrentActivity().then(function(activityId){
    data = {off: true}

    activity = harmonyActivitiesCache[activityId]

    if (activityId != -1 && activity) {
      data = {off: false, current_activity: activity}
    }else{
      data = {off: true, current_activity: activity}
    }

    // cache state for later
    harmonyState = data

    if (!previousActivity || (activity.id != previousActivity.id)) {
      publish('current_activity', activity.slug, {retain: true})
      publish('state', activity.id == -1 ? 'off' : 'on' , {retain: true})

      for (var i = 0; i < cachedHarmonyActivities().length; i++) {
        activities = cachedHarmonyActivities()
        cachedActivity = activities[i]

        if (activity == cachedActivity) {
          publish('activities/' + cachedActivity.slug + '/state', 'on', {retain: true})
        }else{
          publish('activities/' + cachedActivity.slug + '/state', 'off', {retain: true})
        }
      }
    }

  })
}

function cachedHarmonyActivities(){
  return Object.keys(harmonyActivitiesCache).map(function(key) {
    return harmonyActivitiesCache[key]
  })
}

function currentActivity(){
  if (!harmonyHubClient || !harmonyState) { return null}

  return harmonyState.current_activity
}

function activityBySlug(activitySlug){
  var activity
  cachedHarmonyActivities().some(function(a) {
    if(a.slug === activitySlug) {
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
  activity = activityBySlug(req.body.activity)

  if (activity) {
    startActivity(activity.id)

    res.json({message: "ok"})
  }else{
    res.status(404).json({message: "Not Found"})
  }
})

app.listen(process.env.PORT || 8282)
