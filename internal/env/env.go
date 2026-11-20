package env

import (
	"fmt"
	"os"
	"strconv"
)

func GetEnvInt(key string, defaultValue int) int {
	portstring, ok := os.LookupEnv(key)
	if !ok {
		return defaultValue
	}
	portint, err := strconv.Atoi(portstring)
	if err != nil {
		fmt.Printf("unable to convert port from env to int: %s\n using default value", err)
		return defaultValue
	}
	return portint
}

func GetEnvString(key string, defaultValue string) string {
	string, ok := os.LookupEnv(key)
	if !ok {
		return defaultValue
	}
	return string
}
