import { z } from 'zod'

// Step 1: 역할 선택
export const roleSchema = z.object({
  role: z.enum(['groom', 'bride'], {
    required_error: '역할을 선택해주세요.',
  }),
})

// Step 2: 프로필 입력
export const profileSchema = z.object({
  role: z.enum(['groom', 'bride']),
  nickname: z
    .string()
    .min(2, '닉네임은 2자 이상 입력해주세요.')
    .max(10, '닉네임은 10자 이하로 입력해주세요.'),
  phone: z
    .string()
    .regex(/^01[0-9]{8,9}$/, '올바른 휴대폰 번호를 입력해주세요.'),
  verificationCode: z
    .string()
    .length(6, '인증번호 6자리를 입력해주세요.'),
  isPhoneVerified: z.literal(true, {
    errorMap: () => ({ message: '휴대폰 인증을 완료해주세요.' }),
  }),
})

// Step 3: 결혼 정보 입력
export const weddingDetailsSchema = z.object({
  role: z.enum(['groom', 'bride']),
  nickname: z.string(),
  phone: z.string(),
  verificationCode: z.string(),
  isPhoneVerified: z.literal(true),
  weddingDate: z.date({
    required_error: '결혼 예정일을 선택해주세요.',
  }),
  budgetRange: z.enum(
    ['under-3000', '3000-5000', '5000-7000', '7000-10000', 'over-10000'],
    { required_error: '예산 범위를 선택해주세요.' },
  ),
})

// 전체 폼 스키마 (모든 스텝 통합)
export const signupSchema = weddingDetailsSchema

export type SignupFormValues = z.infer<typeof signupSchema>

// 스텝별 필드 매핑
export const stepFields = {
  1: ['role'] as const,
  2: ['nickname', 'phone', 'verificationCode', 'isPhoneVerified'] as const,
  3: ['weddingDate', 'budgetRange'] as const,
}

// 예산 범위 라벨
export const budgetRangeLabels: Record<string, string> = {
  'under-3000': '3,000만원 미만',
  '3000-5000': '3,000 ~ 5,000만원',
  '5000-7000': '5,000 ~ 7,000만원',
  '7000-10000': '7,000만원 ~ 1억원',
  'over-10000': '1억원 이상',
}
