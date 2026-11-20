package main

import (
	"summ-it-up-backend/internal/env"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	app := &application{
		port:    env.GetEnvInt("PORT", 8080),
		origins: env.GetEnvString("allowedOrigins", "*"),
	}
	app.serve()
}
