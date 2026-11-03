import { isValidDateStr, todayStr } from './date'
import { norm } from './text'

const empty = (v) => !v || !String(v).trim()

function checkDate(date, errors) {
  if (!isValidDateStr(date)) errors.date = 'Informe uma data válida.'
  else if (date > todayStr()) errors.date = 'A data não pode estar no futuro.'
}

export const hasErrors = (errors) => Object.keys(errors).length > 0

export function validateStudy(f) {
  const e = {}
  checkDate(f.date, e)
  if (empty(f.subjectId)) e.subjectId = 'Escolha a matéria.'
  if (empty(f.topic)) e.topic = 'Informe o assunto estudado.'
  else if (f.topic.trim().length > 200) e.topic = 'Use até 200 caracteres.'
  if (f.notes && f.notes.length > 2000) e.notes = 'Use até 2000 caracteres.'
  return e
}

export function validateQuestionFields(f) {
  const e = {}
  if (empty(f.statement)) e.statement = 'Escreva o enunciado da questão.'
  if (empty(f.correctAnswer)) e.correctAnswer = 'Informe a resposta correta.'
  const options = (f.options || []).map((s) => s.trim())
  if (options.length) {
    if (options.some((s) => !s)) e.options = 'Preencha ou remova as alternativas vazias.'
    if (options.length < 2) e.options = 'Use ao menos duas alternativas ou remova todas.'
  }
  return e
}

export function validateQuestion(f) {
  const e = validateQuestionFields(f)
  checkDate(f.date, e)
  if (empty(f.subjectId)) e.subjectId = 'Escolha a matéria.'
  if (empty(f.topic)) e.topic = 'Informe o assunto.'
  return e
}

export function validateFlashcard(f) {
  const e = {}
  if (empty(f.subjectId)) e.subjectId = 'Escolha a matéria.'
  if (empty(f.topic)) e.topic = 'Informe o assunto.'
  if (empty(f.front)) e.front = 'Escreva a pergunta (frente).'
  if (empty(f.back)) e.back = 'Escreva a resposta (verso).'
  return e
}

export function validateSubjectName(name, subjects, ignoreId = null) {
  const v = (name || '').trim()
  if (!v) return 'Informe o nome da matéria.'
  if (v.length > 60) return 'Use até 60 caracteres.'
  if (subjects.some((s) => s.id !== ignoreId && norm(s.name) === norm(v))) return 'Já existe uma matéria com esse nome.'
  return ''
}
