FROM python:3-alpine
ENV PORT=10000
EXPOSE 10000
CMD ["sh", "-c", "python -m http.server $PORT"]
