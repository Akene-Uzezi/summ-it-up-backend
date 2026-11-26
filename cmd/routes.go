package main

import (
	"net/http"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func (a *application) routes() http.Handler {
	g := gin.Default()
	g.RedirectTrailingSlash = true

	allowedOrigins := strings.Split(a.origins, ",")

	for i, origin := range allowedOrigins {
		allowedOrigins[i] = strings.TrimSpace(origin)
	}

	g.Use(cors.New(cors.Config{
		AllowOrigins: allowedOrigins,
		AllowMethods: []string{"POST"},
	}))

	v1 := g.Group("/api/v1")

	{
		v1.POST("/summarize", a.summarize)
	}

	return g
}
