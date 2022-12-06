import { Executor } from "./executor.js"

export const main = async() => {

  // If you wish to use a secret manager, construct it here
  
  await new Executor().start()
}


main().catch((e) => {
  console.log(e)
  process.exit(1)
})
