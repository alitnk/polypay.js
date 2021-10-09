import * as drivers from './drivers';
import { SamanOptions } from './drivers/saman/types';
import { ZarinpalOptions } from './drivers/zarinpal/types';
import { ZibalOptions } from './drivers/zibal/types';
import { PaymentInfo, PurchaseOptions, Receipt, VerifyOptions } from './types';
import { Requestish } from './utils';

export type ConfigObject = {
  zarinpal: ZarinpalOptions;
  zibal: ZibalOptions;
  saman: SamanOptions;
};

type Driver = {
  request(options: PurchaseOptions): Promise<PaymentInfo>;
  verify(options: VerifyOptions, req: Requestish): Promise<Receipt>;
};

/**
 * The "inclusive" API
 *
 * This method is used for when you want to let user decide which driver to use.
 * If you solely want to use one driver, import the driver explicitly.
 *
 * @param driver Enter a driver name (e.g. zarinpal)
 * @returns A driver with `request` and `verify` on it
 */
export const getPaymentDriver = (driverName: keyof ConfigObject, ConfigObject: Partial<ConfigObject>): Driver => {
  const driver: Driver = drivers[driverName];
  if (ConfigObject) {
    const config = ConfigObject[driverName] || {};
    driver.request = (options: PurchaseOptions) => driver.request({ ...config, ...options });
    driver.verify = (options: VerifyOptions, req: Requestish) => driver.verify({ ...config, ...options }, req);
  }
  return driver;
};
