export type ApiErrorBody = {
  message?: string
  error?: string
  detail?: string
  code?: string
  status?: number
  errors?: unknown
}

const ERROR_MESSAGES: Record<string, string> = {
  GEN_001: "Sunucuda beklenmeyen bir hata oluştu.",
  GEN_400: "Gönderilen bilgiler geçersiz. Lütfen alanları kontrol edin.",
  AUTH_001: "Kullanıcı adı veya şifre hatalı.",
  AUTH_002: "Oturum bilgisi geçersiz.",
  AUTH_003: "Oturumun süresi doldu.",
  AUTH_004: "Bu işlem için yetkiniz yok.",
  AUTH_005: "Bu işlem için giriş yapmanız gerekiyor.",
  AUTH_006: "Bu e-posta adresine ait bir hesap bulunamadı.",
  AUTH_007: "Girdiğiniz doğrulama kodu hatalı.",
  AUTH_008: "Doğrulama kodunun süresi doldu. Yeni bir kod isteyin.",
  AUTH_009: "Yeni kod istemeden önce lütfen kısa bir süre bekleyin.",
  AUTH_010: "Çok fazla hatalı deneme yaptınız. Yeni bir kod isteyin.",
  AUTH_011: "Şifre yenileme oturumunun süresi doldu. İşlemi baştan başlatın.",
  AUTH_012: "Girdiğiniz şifreler birbiriyle eşleşmiyor.",
  AUTH_013:
    "Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin.",
  AUTH_014:
    "Çok fazla hatalı giriş denemesi yaptınız. Lütfen daha sonra tekrar deneyin.",
  AUTH_015:
    "Bu ağdan çok fazla doğrulama kodu istendi. Lütfen daha sonra tekrar deneyin.",
  AUTH_016:
    "Bu ağdan çok fazla doğrulama denemesi yapıldı. Lütfen daha sonra tekrar deneyin.",
  AUTH_017:
    "Çok fazla oturum yenileme isteği yapıldı. Lütfen daha sonra tekrar deneyin.",
  AUTH_018: "Yeni parolanız mevcut parolanızdan farklı olmalıdır.",
  AUTH_019: "Devam etmek için ilk parolanızı değiştirmeniz gerekiyor.",
  USER_001: "Kullanıcı bulunamadı.",
  USER_002: "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.",
  USER_003: "Bu kullanıcı adı daha önce alınmış.",
  COMPANY_001: "Şirket bulunamadı.",
  COMPANY_002: "Rol ve şirket seçimi birbiriyle uyumlu değil.",
  COMPANY_003: "Bu isimde aktif bir şirket zaten bulunuyor.",
  FUND_001: "Başlangıç portföy büyüklüğü izin verilen aralığın dışında.",
  FUND_002: "Fon bulunamadı veya bu fonu görüntüleme yetkiniz yok.",
  FUND_003:
    "Fonun izleme verileri henüz hesaplanamıyor. Lütfen daha sonra tekrar deneyin.",
  FUND_004: "Fon taslağı bulunamadı.",
  FUND_005: "Fon tasarım profili bulunamadı.",
  FUND_006: "Fon pay fiyatı izin verilen aralığın dışında.",
  FUND_007: "Fon adı geçersiz.",
  FUND_008: "Portföy kuralları izin verilen sınırların dışında.",
  FUND_009: "AI analizi için önce portföy kurallarını kaydedin.",
  FUND_010: "Model evreninde kullanılabilir hisse bulunamadı.",
  FUND_011: "Hariç tutulan veya zorunlu hisseler bu taslak için geçersiz.",
  FUND_012: "Fon taslağı başlangıç sayfası geçersiz veya eksik parametre var.",
  FUND_013: "Bu taslak için eşleşen analiz sonucu bulunamadı.",
  FUND_014: "Seçilen öneri bu analizde bulunamadı.",
  FUND_015: "Çalışma portföyü verisi geçersiz.",
  OPT_001: "Optimizasyon isteği bulunamadı.",
  OPT_002: "Seçilen hisse yatırım evreninde tanımlı değil.",
  OPT_003: "Girilen kısıt değerleri izin verilen aralığın dışında.",
  OPT_004: "Girilen kısıtlar birlikte karşılanamıyor.",
  OPT_005:
    "Bir hisse aynı anda hem hariç tutulacaklar hem zorunlu eklenecekler arasında olamaz.",
  OPT_006: "Hisse için girilen alt/üst limit birbiriyle uyumsuz.",
  OPT_007:
    "Bu istek başka bir işlemle güncellendi. Lütfen sayfayı yenileyip tekrar deneyin.",
  OPT_008: "Bu optimizasyon isteği şu anki durumundan istenen duruma geçemez.",
  STRESS_001:
      "Stres testi çalıştırılabilecek seçili bir portföy bulunamadı.",
  STRESS_002:
      "Seçilen stres senaryosu bulunamadı veya artık kullanılamıyor.",
  STRESS_003:
      "Stres testi sonucu bulunamadı.",
}

function fallbackMessage(fallback: string): string {
  const normalized = fallback.trim()
  if (!normalized) return "İşlem tamamlanamadı. Lütfen tekrar deneyin."
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code
  }

  get isPermissionError() {
    return this.status === 403 || this.code === "AUTH_004"
  }
}

export function toApiRequestError(
  body: ApiErrorBody,
  status: number,
  fallback: string,
): ApiRequestError {
  const message =
    (body.code ? ERROR_MESSAGES[body.code] : undefined) ??
    fallbackMessage(fallback)

  return new ApiRequestError(message, status, body.code)
}

export function isPermissionError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.isPermissionError
}
