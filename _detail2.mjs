import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const q = (sql) => p.$queryRawUnsafe(sql).catch(e=>[{err:e.message.slice(0,140)}])

console.log('=== Does PT (Hammy) capture any detail? ===')
console.dir(await q(`SELECT count(*)::int AS guided_step_logs FROM "GuidedStepLog" gsl JOIN "RoutineLog" rl ON rl.id=gsl."routineLogId" JOIN "Routine" r ON r.id=rl."routineId" WHERE r.name='PT (Hammy)'`))
console.log('--- PT (Hammy) TEMPLATE (programmed guided steps) ---')
console.dir(await q(`SELECT gs.title, e.name AS exercise, gs."setCount", gs."repCount", gs."durationSec" FROM "GuidedStep" gs JOIN "Routine" r ON r.id=gs."routineId" LEFT JOIN "Exercise" e ON e.id=gs."exerciseId" WHERE r.name='PT (Hammy)' ORDER BY gs."sortOrder"`), {depth:null})

console.log('\n=== Legs B / Full Body — set detail (quoted) ===')
const legs = await q(`
  SELECT rl."performedAt"::date AS d, r.name AS routine, e.name AS exercise,
         se2."setNumber" AS setn, se2.reps, se2.seconds, se2."weightLb" AS wt
  FROM "RoutineLog" rl JOIN "Routine" r ON r.id=rl."routineId"
  JOIN "SessionExercise" se ON se."routineLogId"=rl.id
  JOIN "Exercise" e ON e.id=se."exerciseId"
  LEFT JOIN "SetEntry" se2 ON se2."sessionExerciseId"=se.id
  WHERE r.name IN ('Legs B','Full Body') AND rl."performedAt">='2026-05-25'
  ORDER BY rl."performedAt" DESC, e.name, se2."setNumber"`)
let key=null
for (const x of legs){ if(x.err){console.log(x.err);break}
  const k=(x.d?.toISOString?.().slice(0,10)||x.d)+'  '+x.routine+' / '+x.exercise
  if(k!==key){key=k;console.log('\n '+k)}
  console.log('   set'+x.setn, [x.reps&&x.reps+'r', x.seconds&&x.seconds+'s', x.wt&&x.wt+'lb'].filter(Boolean).join(' ')||'(no set data)') }
await p.$disconnect()
