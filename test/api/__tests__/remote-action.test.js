const { createMockReq, createMockRes } = require('../helpers')

describe('remote-action API handlers', () => {
  let broadcastMock
  let remoteActionModule

  beforeEach(() => {
    jest.resetModules()
    broadcastMock = jest.fn()
    global.BROADCAST_EVENT = broadcastMock
    global.SHARED_SYSTEM_INSTANCE = {
      getSystem: jest.fn().mockResolvedValue({
        name: 'Sol',
        station: 'Daedalus',
        body: 'Earth'
      })
    }
    global.ELITE_LOG = {
      getEvent: jest.fn().mockImplementation(async (eventName) => {
        if (eventName === 'NavRoute') {
          return [{
            Route: [
              { StarSystem: 'Alpha Centauri' },
              { StarSystem: 'Barnard\'s Star' },
              { StarSystem: 'Wolf 359' }
            ]
          }]
        }
        return []
      })
    }

    remoteActionModule = require('../../../src/service/lib/api/remote-action')
  })

  afterEach(() => {
    delete global.BROADCAST_EVENT
    delete global.SHARED_SYSTEM_INSTANCE
    delete global.ELITE_LOG
  })

  describe('/api/copy and copy action', () => {
    it('copies literal text string provided in body (POST)', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/api/copy',
        body: { text: 'Jameson Memorial' }
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.action).toBe('copy')
      expect(res.body.text).toBe('Jameson Memorial')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        text: 'Jameson Memorial'
      }))
    })

    it('copies text string provided in query params (GET)', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?text=Shinrarta+Dezhra'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.text).toBe('Shinrarta Dezhra')
    })

    it('copies dynamic current-system target', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?target=current-system'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.text).toBe('Sol')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        text: 'Sol'
      }))
    })

    it('copies dynamic current-station target', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?target=current-station'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.text).toBe('Daedalus')
    })

    it('copies dynamic destination target from nav route', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?target=destination'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.text).toBe('Wolf 359')
    })

    it('copies dynamic next-system target from nav route', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?target=next-system'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.text).toBe('Alpha Centauri')
    })

    it('triggers Station A copy via /api/copy?target=station-1 or station-a', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?target=station-1'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.target).toBe('station-a')
      expect(res.body.label).toBe('Station A')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        target: 'station-a',
        label: 'Station A'
      }))
    })

    it('triggers Station B copy via /api/copy?target=station-2 or station-b', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?target=station-2'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.target).toBe('station-b')
      expect(res.body.label).toBe('Station B')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        target: 'station-b',
        label: 'Station B'
      }))
    })

    it('triggers Station A copy via /api/copy/station-1 shorthand handler', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy/station-1'
      })
      const res = createMockRes()

      await remoteActionModule.copyStation1Handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.target).toBe('station-a')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        target: 'station-a'
      }))
    })

    it('triggers Station B copy via /api/copy/station-2 shorthand handler', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy/station-2'
      })
      const res = createMockRes()

      await remoteActionModule.copyStation2Handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.target).toBe('station-b')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        target: 'station-b'
      }))
    })

    it('triggers System A copy via /api/copy?target=system-1 or system-a', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?target=system-1'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.target).toBe('system-a')
      expect(res.body.label).toBe('System A')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        target: 'system-a'
      }))
    })

    it('triggers System B copy via /api/copy?target=system-2 or system-b', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy?target=system-2'
      })
      const res = createMockRes()

      await remoteActionModule.copyHandler(req, res)

      expect(res.body.label).toBe('System B')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        target: 'system-b'
      }))
    })

    it('triggers System A copy via /api/copy/system-1 shorthand handler', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy/system-1'
      })
      const res = createMockRes()

      await remoteActionModule.copySystem1Handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.target).toBe('system-a')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        target: 'system-a'
      }))
    })

    it('triggers System B copy via /api/copy/system-2 shorthand handler', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/copy/system-2'
      })
      const res = createMockRes()

      await remoteActionModule.copySystem2Handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.target).toBe('system-b')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'copy',
        target: 'system-b'
      }))
    })
  })

  describe('Route Scout next/prev route navigation', () => {
    it('dispatches next-route action via nextRouteHandler', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/route/next'
      })
      const res = createMockRes()

      await remoteActionModule.nextRouteHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.action).toBe('next-route')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'next-route'
      }))
    })

    it('dispatches prev-route action via prevRouteHandler', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/route/prev'
      })
      const res = createMockRes()

      await remoteActionModule.prevRouteHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.action).toBe('prev-route')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'prev-route'
      }))
    })
  })

  describe('INARA left-hand navigation items', () => {
    it('navigates to route-scout panel via /api/inara-nav/route-scout', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/inara-nav/route-scout'
      })
      const res = createMockRes()

      await remoteActionModule.inaraNavHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'click',
        nav: 'route-scout'
      }))
    })

    it('navigates to commodities panel via /api/inara-nav/commodities', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/inara-nav/commodities'
      })
      const res = createMockRes()

      await remoteActionModule.inaraNavHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'click',
        nav: 'commodities'
      }))
    })

    it('navigates to engineering panel via /api/inara-nav/engineering', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/inara-nav/engineering'
      })
      const res = createMockRes()

      await remoteActionModule.inaraNavHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'click',
        nav: 'engineering'
      }))
    })
  })

  describe('/api/click and click action', () => {
    it('handles click with selector', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/api/click',
        body: { selector: '#primaryNavigation button[data-primary-navigation="1"]' }
      })
      const res = createMockRes()

      await remoteActionModule.clickHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.action).toBe('click')
      expect(res.body.selector).toBe('#primaryNavigation button[data-primary-navigation="1"]')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'click',
        selector: '#primaryNavigation button[data-primary-navigation="1"]'
      }))
    })

    it('handles click with text query', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/click?text=SYSTEM'
      })
      const res = createMockRes()

      await remoteActionModule.clickHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.text).toBe('SYSTEM')
    })

    it('handles click with primary navigation number', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/click?primary=2'
      })
      const res = createMockRes()

      await remoteActionModule.clickHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.primary).toBe(2)
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'click',
        primary: 2
      }))
    })

    it('returns 400 when no click target is specified', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/api/click',
        body: {}
      })
      const res = createMockRes()

      await remoteActionModule.clickHandler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })
  })

  describe('/api/navigate and navigate action', () => {
    it('handles navigation by path', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/navigate?path=/ship/cargo'
      })
      const res = createMockRes()

      await remoteActionModule.navigateHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.path).toBe('/ship/cargo')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'navigate',
        path: '/ship/cargo'
      }))
    })

    it('returns 400 when path is missing', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/api/navigate',
        body: {}
      })
      const res = createMockRes()

      await remoteActionModule.navigateHandler(req, res)

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })
  })

  describe('/api/notify and notify action', () => {
    it('handles custom toast notification', async () => {
      const req = createMockReq({
        method: 'GET',
        url: '/api/notify?message=Mission+Accomplished'
      })
      const res = createMockRes()

      await remoteActionModule.notifyHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toBe('Mission Accomplished')
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'notify',
        message: 'Mission Accomplished'
      }))
    })
  })

  describe('/api/remote-action general dispatcher', () => {
    it('dispatches hotkey action', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/api/remote-action',
        body: { action: 'key', key: '1', alt: true }
      })
      const res = createMockRes()

      await remoteActionModule.remoteActionHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.key).toBe('1')
      expect(res.body.alt).toBe(true)
      expect(broadcastMock).toHaveBeenCalledWith('remoteAction', expect.objectContaining({
        action: 'key',
        key: '1',
        alt: true
      }))
    })

    it('returns 405 on unsupported HTTP methods like DELETE', async () => {
      const req = createMockReq({
        method: 'DELETE',
        url: '/api/remote-action'
      })
      const res = createMockRes()

      await remoteActionModule.remoteActionHandler(req, res)

      expect(res.statusCode).toBe(405)
      expect(res.body.error).toBe('Method not allowed')
    })
  })
})
