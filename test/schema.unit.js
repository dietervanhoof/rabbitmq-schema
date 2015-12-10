var Code = require('code')
var keypather = require('keypather')()
var Lab = require('lab')
var put = require('101/put')
var sinon = require('sinon')

var RabbitSchema = require('../index')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var expect = Code.expect

describe('rabbitmq-schema', function () {
  var ctx
  beforeEach(function (done) {
    ctx = {}
    done()
  })

  describe('constructor', function () {
    beforeEach(function (done) {
      ctx.mockValidated = {}
      sinon.stub(RabbitSchema, 'validate').returns(ctx.mockValidated)
      done()
    })
    afterEach(function (done) {
      RabbitSchema.validate.restore()
      done()
    })

    it('should validate and set json', function (done) {
      var json = {}
      var schema = new RabbitSchema(json)
      sinon.assert.calledWith(RabbitSchema.validate, ctx.mockValidated)
      expect(schema._json).to.deep.equal(ctx.mockValidated)

      done()
    })
  })

  describe('validate', function () {
    beforeEach(function (done) {
      ctx.queueErr = new Error('boomErr')
      ctx.exchangeErr = new Error('exchangeErr')
      sinon.stub(RabbitSchema, '_validateExchange').throws(ctx.exchangeErr)
      sinon.stub(RabbitSchema, '_validateQueue').throws(ctx.queueErr)
      done()
    })
    afterEach(function (done) {
      RabbitSchema._validateExchange.restore()
      RabbitSchema._validateQueue.restore()
      done()
    })

    it('should throw an RabbitSchemaValidationError if json is not an object', function (done) {
      expect(RabbitSchema.validate.bind(null, 'foo'))
        .to.throw(/value.*object/)
      done()
    })

    it('should throw an SchemaValidationError if json is circular', function (done) {
      var circular = {}
      circular.foo = circular
      expect(RabbitSchema.validate.bind(null, circular))
        .to.throw(/value.*circular/)
      done()
    })

    it('should throw an SchemaValidationError if both invalid queue and invalid exchange', function (done) {
      var json = {}
      expect(RabbitSchema.validate.bind(null, json))
        .to.throw(/must be a queue.*exchange/)
      done()
    })

    it('should attempt to validate as a queue if it is queue-like', function (done) {
      var json = { queue: 'queue-name' }
      expect(RabbitSchema.validate.bind(null, json))
        .to.throw(ctx.queueErr.message)
      sinon.assert.calledWith(RabbitSchema._validateQueue, json)
      done()
    })

    it('should attempt to validate as a exchange if it is exchange-like', function (done) {
      var json = { exchange: 'exchange-name' }
      expect(RabbitSchema.validate.bind(null, json))
        .to.throw(ctx.exchangeErr.message)
      sinon.assert.calledWith(RabbitSchema._validateExchange, json)
      done()
    })

    it('should attempt array as an array of connected topologies', function (done) {
      var json = [
        { queue: 'queue', messageSchema: {} }, // valid
        { exchange: 'exchange-name' } // invalid

      ]
      expect(RabbitSchema.validate.bind(null, json))
        .to.throw(ctx.exchangeErr.message)
      sinon.assert.calledWith(RabbitSchema._validateExchange, json[1], '[1]')
      done()
    })
  // full topology validation tests in topology.test.js
  })

  describe('validate nested', function () {
    beforeEach(function (done) {
      ctx.json = {
        exchange: 'exchange1',
        type: 'direct',
        bindings: [{
          routingPattern: 'key',
          destination: {
            exchange: 'exchange2',
            type: 'topic',
            bindings: [{
              routingPattern: 'key'
            }] // invalid
          }
        }]
      }
      done()
    })
    it('should throw an SchemaValidationError if both invalid queue and invalid exchange', function (done) {
      keypather.set(ctx.json, 'bindings[0].destination.bindings[0]', null)
      expect(RabbitSchema.validate.bind(null, ctx.json))
        .to.throw("'bindings[0].destination.bindings[0]' should be object")

      done()
    })

    it('should attempt to validate as a queue if it is queue-like', function (done) {
      keypather.set(ctx.json,
        'bindings[0].destination.bindings[0].destination', { queue: 'queue' })
      expect(RabbitSchema.validate.bind(null, ctx.json))
        .to.throw("'bindings[0].destination.bindings[0].destination' should have required property 'messageSchema'")

      done()
    })

    it('should attempt to validate as a exchange if it is exchange-like', function (done) {
      keypather.set(ctx.json,
        'bindings[0].destination.bindings[0].destination', { exchange: 'exchange' })
      expect(RabbitSchema.validate.bind(null, ctx.json))
        .to.throw("'bindings[0].destination.bindings[0].destination.type' must be direct, topic, or fanout")

      done()
    })

    describe('validate nested array', function () {
      beforeEach(function (done) {
        ctx.json = [ ctx.json ]

        done()
      })

      it('should throw an SchemaValidationError if both invalid queue and invalid exchange', function (done) {
        keypather.set(ctx.json, '[0].bindings[0].destination.bindings[0]', null)
        expect(RabbitSchema.validate.bind(null, ctx.json))
          .to.throw("'[0].bindings[0].destination.bindings[0]' should be object")

        done()
      })

      it('should attempt to validate as a queue if it is queue-like', function (done) {
        keypather.set(ctx.json,
          '[0].bindings[0].destination.bindings[0].destination', { queue: 'queue' })
        expect(RabbitSchema.validate.bind(null, ctx.json))
          .to.throw("'[0].bindings[0].destination.bindings[0].destination' should have required property 'messageSchema'")

        done()
      })

      it('should attempt to validate as a exchange if it is exchange-like', function (done) {
        keypather.set(ctx.json,
          '[0].bindings[0].destination.bindings[0].destination', { exchange: 'exchange' })
        expect(RabbitSchema.validate.bind(null, ctx.json))
          .to.throw("'[0].bindings[0].destination.bindings[0].destination.type' must be direct, topic, or fanout")

        done()
      })
    })
  })

  describe('_validateQueue', function () {
    it('should throw an SchemaValidationError if invalid queue', function (done) {
      var json = {
        queue: 'queue-name'
      }
      expect(RabbitSchema._validateQueue.bind(null, json))
        .to.throw(/required.*messageSchema/)
      done()
    })

    it('should validate successfull', function (done) {
      var json = {
        queue: 'queue-name',
        messageSchema: {}
      }
      RabbitSchema._validateQueue(json)
      done()
    })
  // full queue validation tests in queue.test.js
  })

  describe('_validateExchange', function () {
    it('should throw an SchemaValidationError if invalid queue', function (done) {
      var json = {
        exchange: 'exchange-name'
      }
      expect(RabbitSchema._validateExchange.bind(null, json))
        .to.throw(/type.*must be/)
      done()
    })

    it('should validate successfully', function (done) {
      var json = {
        exchange: 'exchange-name',
        type: 'fanout',
        bindings: [{
          destination: {
            queue: 'queue',
            messageSchema: {}
          }
        }]
      }
      RabbitSchema._validateExchange(json)
      done()
    })
  // full exchange validation tests in exchange.test.js
  })

  describe('instance methods', function () {
    describe('validateMessage', function () {
      beforeEach(function (done) {
        ctx.queue = {
          queue: 'queue-name',
          messageSchema: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'queue-name message schema',
            type: 'object',
            properties: {
              foo: { type: 'string' },
              bar: { type: 'string' }
            },
            required: ['foo']
          }
        }
        ctx.validMessage = { foo: 'foo', 'bar': 'bar' }
        done()
      })

      describe('direct queue message', function () {
        beforeEach(function (done) {
          ctx.schema = new RabbitSchema(ctx.queue)
          done()
        })

        it('should error if queue does not exist', function (done) {
          var schema = ctx.schema
          expect(
            schema.validateMessage.bind(schema, '', 'non-existant-queue', {})
          ).to.throw(/queue.*does not exist/)
          done()
        })

        it('should error if the message is invalid for any destination queues', function (done) {
          var schema = ctx.schema
          expect(
            schema.validateMessage.bind(schema, 'queue-name', {})
          ).to.throw(/required property.*foo/)
          done()
        })

        it('should pass if the message is valid', function (done) {
          // expect no errors
          ctx.schema.validateMessage('', 'queue-name', ctx.validMessage)
          done()
        })
      })

      describe('largeSchema', function () {
        beforeEach(function (done) {
          ctx.json = {
            exchange: 'exchange1',
            type: 'direct',
            bindings: [
              {
                routingPattern: 'routing.key',
                destination: {
                  exchange: 'exchange2',
                  type: 'topic',
                  bindings: [
                    {
                      routingPattern: 'miss.routing.key',
                      destination: {
                        exchange: 'miss-exchange1',
                        type: 'fanout',
                        bindings: [{
                          destination: ctx.queue
                        }]
                      }
                    },
                    {
                      routingPattern: 'routing.key',
                      destination: {
                        exchange: 'exchange3',
                        type: 'fanout',
                        bindings: [{
                          destination: ctx.queue
                        }]
                      }
                    }
                  ]
                }
              }
            ]
          }
          ctx.schema = new RabbitSchema(ctx.json)
          done()
        })

        describe('validateMessage', function () {
          it('should error if the exchange does not exist', function (done) {
            var schema = ctx.schema
            expect(
              schema.validateMessage.bind(schema, 'non-existant-exchange', 'routing.key', {})
            ).to.throw(/exchange.*does not exist/)
            done()
          })

          it('should error if the message does not reach any destination queues', function (done) {
            var schema = ctx.schema
            expect(
              schema.validateMessage.bind(schema, 'exchange1', 'foo.bar', {})
            ).to.throw(/did not reach any queues/)
            done()
          })

          it('should error if the message is invalid for any destination queues', function (done) {
            var schema = ctx.schema
            expect(
              schema.validateMessage.bind(schema, 'exchange1', 'routing.key', {})
            ).to.throw(/required property.*foo.*exchange1[.]exchange2[.]exchange3[.]queue-name[.]messageSchema/)
            done()
          })

          it('should pass if the message is valid', function (done) {
            ctx.schema.validateMessage('exchange1', 'routing.key', { foo: 'foo', bar: 'bar' })
            done()
          })
        })

        describe('getExchanges', function () {
          it('should get exchanges from a json', function (done) {
            var exchanges = ctx.schema.getExchanges()
            expect(exchanges).to.deep.equal([
              ctx.json,
              ctx.json.bindings[0].destination,
              ctx.json.bindings[0].destination.bindings[0].destination,
              ctx.json.bindings[0].destination.bindings[1].destination
            ])
            // twice for coverage
            expect(ctx.schema.getExchanges()).to.not.equal(ctx.schema._exchanges)
            expect(ctx.schema.getExchanges()).to.deep.equal(ctx.schema._exchanges)
            done()
          })
        })

        describe('getQueues', function (done) {
          it('should get queues from a json', function (done) {
            var queues = ctx.schema.getQueues()
            expect(queues).to.deep.equal([ ctx.queue ])
            // twice for coverage
            expect(ctx.schema.getQueues()).to.not.equal(ctx.schema._queues)
            expect(ctx.schema.getQueues()).to.deep.equal(ctx.schema._queues)
            done()
          })
        })

        describe('getElements', function () {
          it('should get all elements from a json', function (done) {
            var elements = ctx.schema._getElements()
            expect(elements).to.deep.equal([
              ctx.json,
              ctx.json.bindings[0].destination,
              ctx.json
                .bindings[0].destination
                .bindings[0].destination,
              ctx.json
                .bindings[0].destination
                .bindings[0].destination
                .bindings[0].destination,
              ctx.json
                .bindings[0].destination
                .bindings[1].destination,
              ctx.json
                .bindings[0].destination
                .bindings[1].destination
                .bindings[0].destination
            ])
            // twice for coverage
            expect(ctx.schema._getElements()).to.deep.equal(ctx.schema._elements)
            done()
          })
        })
        describe('getQueueByName', function () {
          it('should get a queue by name', function (done) {
            expect(ctx.schema.getQueueByName(ctx.queue.queue)).to.deep.equal(ctx.queue)
            // twice for coverage
            expect(ctx.schema.getQueueByName(ctx.queue.queue)).to.deep.equal(ctx.queue)
            done()
          })
        })
        describe('getExchangeByName', function () {
          it('should get an exchange by name', function (done) {
            expect(ctx.schema.getExchangeByName('exchange2'))
              .to.deep.equal(ctx.json.bindings[0].destination)
            // twice for coverage
            expect(ctx.schema.getExchangeByName('exchange2'))
              .to.deep.equal(ctx.json.bindings[0].destination)
            done()
          })
        })
        describe('getBindings', function () {
          it('should get all elements from a json', function (done) {
            var exchanges = ctx.schema.getExchanges()
            var bindings = ctx.schema.getBindings()
            var expectedBindings = []
            exchanges.forEach(function (exchange) {
              var newBindings = exchange.bindings.map(put('source', exchange))
              expectedBindings = expectedBindings.concat(newBindings)
            })
            expect(bindings).to.deep.equal(expectedBindings)
            // twice for coverage
            expect(ctx.schema.getBindings()).to.deep.equal(ctx.schema._bindings)
            done()
          })
        })
        describe('toJSON', function () {
          it('should return a clone of the original json', function (done) {
            expect(ctx.schema.toJSON()).to.deep.equal(ctx.schema._json)
            done()
          })
        })
      })
    })
  })
})