import { Store } from '../../database/Store';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Store', () => {
  let store: Store;
  const dbPath = join(tmpdir(), 'test-smshub.db');

  beforeEach(async () => {
    store = new Store(dbPath);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
  });

  describe('Modem Operations', () => {
    const testModem = {
      id: 'test-modem-1',
      pluginName: 'test-plugin',
      devicePath: '/dev/ttyUSB0',
      imei: '123456789012345',
      iccid: '89012345678901234567',
      operator: 'Test Operator'
    };

    test('should save and retrieve modem', async () => {
      await store.saveModem(testModem);
      const savedModem = await store.getModem(testModem.id);
      expect(savedModem).toMatchObject(testModem);
    });

    test('should update existing modem', async () => {
      await store.saveModem(testModem);
      const updatedModem = { ...testModem, operator: 'New Operator' };
      await store.saveModem(updatedModem);
      const savedModem = await store.getModem(testModem.id);
      expect(savedModem?.operator).toBe('New Operator');
    });
  });

  describe('Message Operations', () => {
    const testMessage = {
      modemId: 'test-modem-1',
      sender: '+1234567890',
      message: 'Test message',
      timestamp: new Date(),
      status: 'received' as const
    };

    test('should save and retrieve message', async () => {
      const messageId = await store.saveMessage(testMessage);
      const savedMessage = await store.getMessage(messageId);
      expect(savedMessage).toMatchObject(testMessage);
    });

    test('should update message status', async () => {
      const messageId = await store.saveMessage(testMessage);
      await store.updateMessageStatus(messageId, 'sent');
      const updatedMessage = await store.getMessage(messageId);
      expect(updatedMessage?.status).toBe('sent');
    });

    test('should delete message', async () => {
      const messageId = await store.saveMessage(testMessage);
      await store.deleteMessage(messageId);
      const deletedMessage = await store.getMessage(messageId);
      expect(deletedMessage).toBeNull();
    });
  });

  describe('Plugin Operations', () => {
    const pluginId = 'test-plugin';

    test('should enable and disable plugin', async () => {
      await store.enablePlugin(pluginId);
      let enabledPlugins = await store.getEnabledPlugins();
      expect(enabledPlugins).toContain(pluginId);

      await store.disablePlugin(pluginId);
      enabledPlugins = await store.getEnabledPlugins();
      expect(enabledPlugins).not.toContain(pluginId);
    });
  });

  describe('Statistics Operations', () => {
    const testStats = {
      modemId: 'test-modem-1',
      signalStrength: 80,
      technology: '4G',
      band: 'B7'
    };

    test('should save and retrieve modem stats', async () => {
      await store.saveModemStats(testStats.modemId, testStats);
      const stats = await store.getModemStats(testStats.modemId, 1);
      expect(stats[0]).toMatchObject(testStats);
    });

    test('should get stats summary', async () => {
      // Add some test data
      await store.saveMessage({
        modemId: 'test-modem-1',
        sender: '+1234567890',
        message: 'Test message',
        timestamp: new Date(),
        status: 'sent'
      });

      const summary = await store.getStatsSummary('24h');
      expect(summary).toHaveProperty('totalMessages');
      expect(summary).toHaveProperty('successRate');
      expect(summary).toHaveProperty('activeModems');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid modem ID', async () => {
      await expect(store.getModem('invalid-id')).resolves.toBeNull();
    });

    test('should handle invalid message ID', async () => {
      await expect(store.getMessage(-1)).resolves.toBeNull();
    });

    test('should handle database errors', async () => {
      // Close the database to simulate an error
      await store.close();
      await expect(store.saveModem({} as any)).rejects.toThrow();
    });
  });
}); 