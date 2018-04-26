'use strict'

var utils = require('../core/utils')

/**
 * interceptor queue
 */
var state = {reqQueue: [], respQueue: []}

function useInterceptors (calls) {
  return function (callback) {
    if (calls.indexOf(callback) === -1) {
      calls.push(callback)
    }
  }
}

/**
 * request interceptor
 */
function requestInterceptor (request) {
  var XEPromise = request.$Promise || Promise
  var thenInterceptor = XEPromise.resolve(request, request.$context)
  utils.arrayEach(state.reqQueue, function (callback) {
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
function responseInterceptor (request, response) {
  var XEPromise = request.$Promise || Promise
  var thenInterceptor = XEPromise.resolve(response, request.$context)
  utils.arrayEach(state.respQueue, function (callback) {
    thenInterceptor = thenInterceptor.then(function (response) {
      return new XEPromise(function (resolve) {
        callback(response, function (resp) {
          if (resp && resp.body && resp.status) {
            resolve(utils.toResponse(resp, request))
          } else {
            resolve(response)
          }
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
    use: useInterceptors(state.reqQueue)
  },
  response: {
    use: useInterceptors(state.respQueue)
  }
}

// default interceptor
interceptors.request.use(function (request, next) {
  if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
    if (!utils.isFormData(request.body)) {
      request.headers.set('Content-Type', 'application/x-www-form-urlencoded')
      if (request.bodyType === 'json-data' || request.bodyType === 'json_data') {
        request.headers.set('Content-Type', 'application/json; charset=utf-8')
      }
    }
  }
  if (utils.isCrossOrigin(request.getUrl())) {
    request.headers.set('X-Requested-With', 'XMLHttpRequest')
  }
  next()
})

var interceptorExports = {
  interceptors: interceptors,
  requestInterceptor: requestInterceptor,
  responseInterceptor: responseInterceptor
}

module.exports = interceptorExports
