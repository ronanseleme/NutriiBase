export function mapAuthError(message: string | undefined | null): string {
  const msg = message || ''
  if (/access_denied/i.test(msg)) {
    return 'Login cancelado.'
  }
  if (/oauth/i.test(msg)) {
    return 'Não foi possível continuar com o Google. Tente novamente.'
  }
  if (/already registered|already exists|user_already_exists/i.test(msg)) {
    return 'Este e-mail já está cadastrado. Tente entrar.'
  }
  if (/invalid login credentials/i.test(msg)) {
    return 'E-mail ou senha incorretos.'
  }
  if (/email not confirmed/i.test(msg)) {
    return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).'
  }
  if (/password should be at least|password.*characters/i.test(msg)) {
    return 'A senha precisa ter pelo menos 6 caracteres.'
  }
  if (/rate limit/i.test(msg)) {
    return 'Muitas tentativas — aguarde um instante e tente de novo.'
  }
  return msg || 'Não foi possível completar a ação. Tente novamente.'
}
