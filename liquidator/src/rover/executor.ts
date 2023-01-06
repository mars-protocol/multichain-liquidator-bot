import { BaseExecutor } from "../BaseExecutor";
import { sleep } from "../helpers";
import { fetchRoverPositions } from "../hive";

export class Executor extends BaseExecutor{
    
    start = async() => {

    }

    run = async() => {
        // pop latest unhealthy position from the list
        const positions = await this.redis.popUnhealthyPositions(1)

        if (positions.length == 0) {
            //sleep to avoid spamming redis db when empty
            await sleep(200)
            console.log(' - No items for liquidation yet')
            return
          }

        // build positions using addresses
        // const roverPosition = await fetchRoverPositions([positions[0].Address])
        
        //  - do message construction
        // const borrowMessages = 

        // await execute() 
        
    }
}