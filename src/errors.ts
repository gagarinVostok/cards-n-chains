import { type ErrorKey, type ErrorParams, STRINGS, type Strings } from './i18n'

/** Error with a translatable key: the UI shows it in the current language, `message` is English. */
export class AppError<K extends ErrorKey = ErrorKey> extends Error {
  constructor(readonly key: K, readonly params: ErrorParams<K> = {} as ErrorParams<K>) {
    super(format(STRINGS.en, key, params))
  }

  translate(t: Strings) {
    return format(t, this.key, this.params)
  }
}

function format<K extends ErrorKey>(t: Strings, key: K, params: ErrorParams<K>) {
  return (t.errors[key] as (p: ErrorParams<K>) => string)(params)
}

export const errorMessage = (e: unknown, t: Strings, fallback: string) =>
  e instanceof AppError ? e.translate(t) : e instanceof Error ? e.message : fallback
