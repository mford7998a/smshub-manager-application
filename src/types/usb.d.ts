declare module 'usb' {
  export interface Device {
    deviceDescriptor: {
      idVendor: number;
      idProduct: number;
      iManufacturer: number;
      iProduct: number;
      iSerialNumber: number;
    };
    interfaces: Interface[];
    open(): void;
    close(): void;
    serialNumber: string | null;
    productId: number;
    devicePath: string;
    transferIn(endpointNumber: number, length: number): Promise<{
      data?: DataView;
      status: number;
    }>;
    transferOut(endpointNumber: number, data: ArrayBuffer): Promise<void>;
  }

  export interface Interface {
    interfaceNumber: number;
    descriptor: {
      bInterfaceClass: number;
    };
    isKernelDriverActive(): boolean;
    detachKernelDriver(): Promise<void>;
    claim(): Promise<void>;
  }

  export function getDeviceList(): Device[];
  export function on(event: 'attach' | 'detach', listener: (device: Device) => void): void;
  export function removeListener(event: string, listener: Function): void;
} 