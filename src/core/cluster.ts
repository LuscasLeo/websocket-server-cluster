import { RedisClient } from "./types";

export async function createClusterCommunication(redisClient: RedisClient, serverChannel: string, onMessage: (message: string) => void) {
    const subscriber = redisClient.duplicate();
  
    await subscriber.connect();
  
    await subscriber.subscribe(serverChannel, (message, channel) => {
      onMessage(message);
    });
  
    const publisher = redisClient.duplicate();
  
    await publisher.connect();
  
    function sendMessage(message: string) {
      publisher.publish(serverChannel, message);
    }
  
    return { sendMessage };
  }
  