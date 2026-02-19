declare module "@garmin/fitsdk" {
  export class Stream {
    static fromBuffer(buffer: Uint8Array): Stream;
    reset(): void;
  }

  export type DecoderReadOptions = {
    convertDateTimesToDates?: boolean;
    convertTypesToStrings?: boolean;
    applyScaleAndOffset?: boolean;
    expandSubFields?: boolean;
    expandComponents?: boolean;
    includeUnknownData?: boolean;
    mergeHeartRates?: boolean;
    mesgListener?: (mesgNum: number, message: Record<string, unknown>) => void;
    fieldDescriptionListener?: (
      key: string | number,
      developerDataIdMesg: unknown,
      fieldDescriptionMesg: unknown
    ) => void;
  };

  export class Decoder {
    constructor(stream: Stream);
    static isFIT(stream: Stream): boolean;
    read(options?: DecoderReadOptions): {
      errors: unknown[];
      messages?: Record<string, unknown>;
    };
  }

  export type EncoderOptions = {
    fieldDescriptions?: Record<
      string,
      {
        developerDataIdMesg: unknown;
        fieldDescriptionMesg: unknown;
      }
    >;
  };

  export class Encoder {
    constructor(options?: EncoderOptions);
    onMesg(mesgNum: number, mesg: Record<string, unknown>): this;
    close(): Uint8Array;
  }

  export const Profile: {
    MesgNum?: Record<string, number>;
  };

  export const Utils: {
    FIT_EPOCH_MS?: number;
  };
}
