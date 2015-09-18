var fs = require('fs')
var path = require('path')
var util = require('util')
var express = require('express')
var morgan = require('morgan')
var bodyParser = require('body-parser')

var harmonyHubDiscover = require('harmonyhubjs-discover')
var harmony = require('harmonyhubjs-client')

var harmonyHubClient
var harmonyActivitiesCache = {}
var harmonyActivityUpdateInterval = 1*60*1000 // 1 minute
var harmonyActivityUpdateTimer

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

    harmony(hubInfo.ip).then(function(harmonyClient) {
      console.log('Harmony client created.')

      harmonyHubClient = harmonyClient

      // update the list of activities
      updateActivities()
      // then do it on the set interval
      clearInterval(harmonyActivityUpdateTimer)
      harmonyActivityUpdateTimer = setInterval(function(){ updateActivities() }, harmonyActivityUpdateInterval)
    })
  }

})


// Look for hubs:
console.log('Starting discovery.')
discover.start()

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

function cachedHarmonyActivities(){
  return Object.keys(harmonyActivitiesCache).map(function(key) {
    return harmonyActivitiesCache[key]
  })
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
  harmonyHubClient.getCurrentActivity().then(function(activityId){
    data = {off: true}

    activity = harmonyActivitiesCache[activityId]

    if (activityId != -1 && activity) {
      data = {off: false, current_activity: activity}
    }else{
      data = {off: true}
    }

    res.json(data)
  })
})

app.put('/off', function(req, res){
  harmonyHubClient.turnOff().then(function(){})
  res.json({message: "ok"})
})

app.post('/start_activity', function(req, res){
  activity = activityByName(req.body.activity_name)

  if (activity) {
    harmonyHubClient.startActivity(activity.id).then(function(){})
    res.json({message: "ok"})
  }else{
    res.status(404).json({message: "Not Found"})
  }
})

app.listen(process.env.PORT || 8282)
