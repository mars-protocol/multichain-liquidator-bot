

export const requiredEnvironmentVariables = (envVars: string[]) => {
    let missing = envVars.filter((v) => process.env[v] === undefined)
  
    if (missing.length > 0) {
      console.error(
        `Required environment variables are not set: ${missing.join(', ')}`
      )
      process.exit(1)
    }
  }