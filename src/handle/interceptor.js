'use strict'

var utils = require('../core/utils')
var handleExports = require('../handle')

/**
 * interceptor queue
 */
var reqQueue = {resolves: [], rejects: []}
var respQueue = {resolves: [], rejects: []}

function addCheckQueue (calls, callback) {
  if (!utils.includes(calls, callback)) {
    calls.push(callback)
  }
}

function useInterceptors (queue) {
  return function (finish, failed) {
    addCheckQueue(queue.resolves, finish)
    addCheckQueue(queue.rejects, failed)
  }
}

/**
 * request interceptor
 */
function requests (request) {
  var XEPromise = request.$Promise || Promise
  var thenInterceptor = XEPromise.resolve(request, request.$context)
  utils.arrayEach(reqQueue.resolves, function (callback) {
    thenInterceptor = thenInterceptor.then(function (req) {
      return new XEPromise(function (resolve) {
        callback(req, function () {
          resolve(req)
        })
      }, request.$context)
    }).catch(function (e) {
      console.error(e)
    })
  })
  return thenInterceptor
}

/**
 * response interceptor
 */
function responseInterceptor (calls, request, response) {
  var XEPromise = request.$Promise || Promise
  var thenInterceptor = XEPromise.resolve(response, request.$context)
  utils.arrayEach(calls, function (callback) {
    thenInterceptor = thenInterceptor.then(function (response) {
      return new XEPromise(function (resolve) {
        callback(response, function (resp) {
          resolve(resp && resp.body && resp.status ? handleExports.toResponse(resp, request) : response)
        }, request)
      }, request.$context)
    }).catch(function (e) {
      console.error(e)
    })
  })
  return thenInterceptor
}

var interceptors = {
  request: {
    use: useInterceptors(reqQueue)
  },
  response: {
    use: useInterceptors(respQueue)
  }
}

// default interceptor
interceptors.request.use(function (request, next) {
  var reqHeaders = request.headers
  var reqBody = request.body
  var reqMethod = request.method
  if (reqBody && reqMethod !== 'GET' && reqMethod !== 'HEAD') {
    if (!utils.isFData(reqBody)) {
      reqHeaders.set('Content-Type', request.bodyType === 'json-data' ? 'application/json; charset=utf-8' : 'application/x-www-form-urlencoded')
    }
  }
  if (utils.isCrossOrigin(request.getUrl())) {
    reqHeaders.set('X-Requested-With', 'XMLHttpRequest')
  }
  next()
})

function responseToResolves (request, response, resolve, reject) {
  responseInterceptor(respQueue.resolves, request, response).then(resolve)
}

function responseToRejects (request, response, resolve, reject) {
  responseInterceptor(respQueue.rejects, request, response).then(function (e) {
    (handleExports.isResponse(e) ? resolve : reject)(e)
  })
}

var interceptorExports = {
  interceptors: interceptors,
  requests: requests,
  toResolves: responseToResolves,
  toRejects: responseToRejects
}

module.exports = interceptorExports
