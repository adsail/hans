declare module 'qrcode-terminal' {
  interface QRCodeOptions {
    small?: boolean;
  }

  export function generate(input: string, options?: QRCodeOptions, callback?: (qrcode: string) => void): void;
  export function generate(input: string, callback?: (qrcode: string) => void): void;
  export function setErrorLevel(level: 'L' | 'M' | 'Q' | 'H'): void;
}
