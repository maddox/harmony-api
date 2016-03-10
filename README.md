# Harmony API!!

Harmony API is a simple REST server allowing you to query/control a local [Harmony
Home Hub](http://myharmony.com/products/detail/home-hub/). Yes, there are libraries
that can already do this (this server uses one :wink:).

But not all languages have Harmony Hub clients. Also, some times these clients are
complicated to add to your other projects. Harmony API gives you a simple REST server
to control your Harmony Hub, so your control is just a simple HTTP request away.

## Features

* List activities.
* Get current status, including if everything is off, or what the current activity is.
* Turn everything off.
* Start a specific activity.

## Setup

    script/bootstrap

## Settings

Harmony API can discover your hub automatically. You can optionally provide an
IP address for your hub and avoid the discovery process. Add a line to your
`config.json` file to provide the IP address.

```json
{
  "hub_ip": "192.168.1.106"
}
```

## Running It
Get up and running immediately with `script/server`.

Harmony API will run on port `8282` by default. Use the `PORT` environment
variable to use your own port.

### Forever
harmony-api has support for [Forever](https://github.com/foreverjs/forever). It uses
`launchd` on OS X to kick it off so that it starts on boot. There is no `init.d`
other Linux support of this type. Pull requests would be welcome for this though.

### Development
You can simply run it by calling `script/server`. This will run it in development
mode with logging to standard out.

### Install as Service on OS X

    script/install

## Logging

Harmony API logs all of its requests. In `production`, it logs to a file at `log/logs.log`.
In `development` mode, it just logs to stdout.

## Development

Launch the app via `script/server` to run it in the development environment.

## MQTT Docs

harmony-api can report its state changes to your MQTT broker. Just edit your
config file in `config/config.json` to add your MQTT host.

harmony-api publishes topics with the namespace of: `harmony-api`.

### State Topics

When the state changes on your harmony hub, state topics will be immediately
broadcasted over your broker. There's quite a few topics that are broadcasted.

Here's a list:

#### Current State

This topic describes the current power state. Message is `on` or `off`.

`harmony-api/state` `on`

#### Current Activity

This topic describes what the current activity of the hub is. The message is
the slug of an activity name.

`harmony-api/current_activity` `watch-tv`

#### Activity States

These topics describe the state of each activity that the hub has. The message
is `on` or `off`. There will a topic for every activity on your hub.

`harmony-api/activities/watch-tv/state` `off`  
`harmony-api/activities/watch-apple-tv/state` `on`  
`harmony-api/activities/play-xbox-one/state` `off`  


### Command Topics

You can also command harmony-api to change activities by publishing topics.
harmony-api listens to this topic and will change to the activity when it sees
it.

Just provide the slug of the activity you want to switch to and `on` as the
message. Any use of this topic with the message `off` will turn everything off.

`harmony-api/activities/watch-tv/command` `on`  


## HTTP API Docs

This is a quick overview of the service. Read [app.js](app.js) if you need more
info.

:warning: These endpoints may not be stable as this project moves fast towards
`1.0.0`.

### Resources

Here's a list of resources that may be returned in a response.

#### Activity Resource

The Activity resource returns all the information you really need for an
Activity set up in your Harmony Hub.

```json
{
  "id": "15233552",
  "slug": "watch-tv",
  "label": "Watch TV",
  "isAVActivity": true
}
```

#### Status Resource

The Status resource returns the current state of your Harmony Hub.

```json
{
  "off": false,
  "current_activity": {
    "id": "15233552",
    "slug": "watch-tv",
    "label": "Watch TV",
    "isAVActivity": true
  }
}
```

### Methods

These are the endpoints you can hit to do things.

#### Info
  Use these endpoints to query the current state of your Harmony Hub.

    GET /status => StatusResource
    GET /activities => {:activities => [ActivityResource, ActivityResource, ...]}

#### Control
  Use these endpoints to control your devices through your Harmony Hub.

    PUT /off => NowPlayingResource => {message: "ok"}
    POST /start_activity?activity=watch-tv => {message: "ok"}

## To Do

- [ ] Support multiple Harmony Hubs
- [ ] Support raw commands to control individual devices


## Contributions

* fork
* create a feature branch
* open a Pull Request
