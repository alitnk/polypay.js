import axios from 'axios';
import { Driver } from 'driver';
import { RequestException, VerificationException } from 'exceptions';
import { LinksObject } from 'types';
import * as API from './api';
import fs from 'fs/promises';
import crypto from 'crypto';
import * as RsaXml from 'rsa-xml';
export class Pasargad extends Driver<API.Config> {
  constructor(config: API.Config) {
    super(config, API.tConfig);
  }
  protected links: LinksObject = API.links;
  requestPayment = async (options: API.RequestOptions) => {
    options = this.getParsedData(options, API.tRequestOptions);
    const { amount, callbackUrl, invoiceDate, invoiceNumber, email, PIDN, mobile, name } = options;
    const { merchantId, terminalId } = this.config;

    const data: API.RequestPaymentReq = {
      MerchantCode: merchantId,
      TerminalCode: terminalId,
      Action: 1003,
      Amount: amount,
      InvoiceDate: invoiceDate,
      InvoiceNumber: invoiceNumber,
      RedirectAddress: callbackUrl,
      Timestamp: this.getCurrentTimestamp(),
    };
    const optionalParams = Object.entries({ email, PIDN, mobile, name });
    for (const param of optionalParams) if (param[1]) data[param[0]] = param[1];

    const response = await axios.post<API.RequestPaymentReq, { data: API.RequestPaymentRes }>(
      this.getLinks().REQUEST,
      data,
      {
        headers: {
          Sign: await this.signData(this.config.certificateFilePath, data),
        },
      },
    );

    if (!response.data?.IsSuccess) {
      throw new RequestException('عملیات با خطا مواجه شد');
    }
    return this.makeRequestInfo(response.data.Token, 'GET', this.getLinks().PAYMENT, { n: response.data.Token });
  };
  verifyPayment = async (_options: API.VerifyOptions, params: API.CallbackParams): Promise<API.Receipt> => {
    const { amount, invoiceDate, invoiceNumber, transactionReferenceID } = params;
    const data: API.VerifyPaymentReq = {
      Amount: amount,
      InvoiceDate: invoiceDate,
      InvoiceNumber: invoiceNumber,
      Timestamp: this.getCurrentTimestamp(),
      TerminalCode: this.config.terminalId,
      MerchantCode: this.config.merchantId,
    };
    const response = await axios.post<API.VerifyPaymentReq, { data: API.VerifyPaymentRes }>(
      this.getLinks().VERIFICATION,
      data,
      {
        headers: {
          Sign: await this.signData(this.config.certificateFilePath, data),
        },
      },
    );
    if (!response.data?.IsSuccess) throw new VerificationException('عملیات با خطا مواجه شد');
    return {
      raw: response.data,
      transactionId: transactionReferenceID,
      cardPan: response.data.MaskedCardNumber,
    };
  };

  private getCurrentTimestamp = (): string => {
    const currentDateISO = new Date().toISOString();
    return currentDateISO.replace(/-/g, '/').replace('T', ' ').replace('Z', '').split('.')[0];
  };

  private signData = async (certificateFilePath: string, data: unknown): Promise<string> => {
    const xmlKey = (await fs.readFile(certificateFilePath)).toString('base64');
    const sign = crypto.createSign('SHA1');
    const pemKey = new RsaXml().exportPemKey(xmlKey);
    sign.write(JSON.stringify(data));
    sign.end();
    const signedData = sign.sign(Buffer.from(pemKey), 'base64');
    return signedData;
  };
}
