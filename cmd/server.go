package main

import (
	"fmt"
	"net/http"
	"time"
)

func (a *application) serve() error {
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", a.port),
		Handler:      a.routes(),
		IdleTimeout:  30 * time.Second,
		ReadTimeout:  1 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	fmt.Printf("Server is running on port %d\n", a.port)
	return server.ListenAndServe()
}
