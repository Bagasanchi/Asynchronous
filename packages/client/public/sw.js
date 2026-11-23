self.addEventListener('push', (event) => {
  const data = event.data?.json()
  if (!data || !/^[a-f0-9-]{36}$/.test(data.match)) return
  event.waitUntil(
    self.registration.showNotification('Asynchronous', {
      body: 'Your Ironclad match is ready for your turn.',
      tag: data.match,
      data: data.match,
    }),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/#match/' + event.notification.data))
})
