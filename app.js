var fs = require('fs')
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

var env = process.env.NODE_ENV || 'development';
var logDirectory = __dirname + '/log'

var app = express()
app.use(bodyParser.urlencoded({ extended: false }))

var logFormat = "'[:date[iso]] - :remote-addr - :method :url :status :response-time ms - :res[content-length]b'"
if ('development' == env){
  app.use(morgan(logFormat))
}else if ('production' == env){
  fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)
  var accessLogStream = fs.createWriteStream(logDirectory + '/' + env + '.log', {flags: 'a'})
  app.use(morgan(logFormat, {stream: accessLogStream}))
}

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

  harmony(harmonyIp).then(function(harmonyClient) {
    harmonyClient.getActivities().then(function(activities){
      foundActivities = {}
      activities.some(function(activity) {
        foundActivities[activity.id] = {id: activity.id, label: activity.label, isAVActivity: activity.isAVActivity}
      })

      harmonyActivitiesCache = foundActivities
      harmonyClient.end()
    })
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

app.get('/activities', function(req, res){
  res.json({activities: cachedHarmonyActivities()})
})

app.get('/status', function(req, res){
  harmony(harmonyIp).then(function(harmonyClient) {
    harmonyClient.getCurrentActivity().then(function(activityId){
      data = {off: true}

      activity = harmonyActivitiesCache[activityId]

      if (activityId != -1 && activity) {
        data = {off: false, current_activity: activity}
      }else{
        data = {off: true}
      }

      harmonyClient.end()
      res.json(data)
    })
  })
})

app.put('/off', function(req, res){
  harmony(harmonyIp).then(function(harmonyClient) {
    harmonyClient.turnOff().then(function(){
      harmonyClient.end()
      res.json({message: "ok"})
    })
  })
})

app.post('/start_activity', function(req, res){
  activity = activityByName(req.body.activity_name)

  if (activity) {
    harmony(harmonyIp).then(function(harmonyClient) {
      harmonyClient.startActivity(activity.id)
      harmonyClient.end()
      res.json({message: "ok"})
    })
  }else{
    res.status(404).json({message: "Not Found"})
  }
})

app.listen(process.env.PORT || 8282)
