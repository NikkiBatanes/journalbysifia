jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
      'AccessibleAfterFirstUnlockThisDeviceOnly',
  },
  SECURITY_LEVEL: {SECURE_SOFTWARE: 'SECURE_SOFTWARE'},
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
}));

import * as Keychain from 'react-native-keychain';
import {
  generateSpikeEncryptionKey,
  getOrCreateSpikeEncryptionKey,
  isValidSpikeEncryptionKey,
  readSpikeEncryptionKey,
} from '../journalEncryptedStorageSpike';

const mockedKeychain = Keychain as jest.Mocked<typeof Keychain>;

describe('Journal encrypted storage spike key boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a 256-bit lowercase hexadecimal key from secure bytes', () => {
    const key = generateSpikeEncryptionKey(bytes => {
      bytes.fill(0xab);
      return bytes;
    });

    expect(key).toBe('ab'.repeat(32));
    expect(isValidSpikeEncryptionKey(key)).toBe(true);
  });

  it('reuses the existing device-only key without rewriting it', async () => {
    const existingKey = '12'.repeat(32);
    mockedKeychain.getGenericPassword.mockResolvedValue({
      service: 'spike',
      username: 'journal-cloud-storage-spike',
      password: existingKey,
      storage: 'keychain',
    });

    await expect(getOrCreateSpikeEncryptionKey()).resolves.toBe(existingKey);
    expect(mockedKeychain.setGenericPassword).not.toHaveBeenCalled();
  });

  it('rejects malformed stored key material instead of replacing it', async () => {
    mockedKeychain.getGenericPassword.mockResolvedValue({
      service: 'spike',
      username: 'journal-cloud-storage-spike',
      password: 'not-a-valid-key',
      storage: 'keychain',
    });

    await expect(getOrCreateSpikeEncryptionKey()).rejects.toThrow(
      'invalid format',
    );
    expect(mockedKeychain.setGenericPassword).not.toHaveBeenCalled();
  });

  it('leaves a missing key missing when checking an existing test database', async () => {
    mockedKeychain.getGenericPassword.mockResolvedValue(false);
    await expect(readSpikeEncryptionKey()).resolves.toBeNull();
    expect(mockedKeychain.setGenericPassword).not.toHaveBeenCalled();
  });
});
